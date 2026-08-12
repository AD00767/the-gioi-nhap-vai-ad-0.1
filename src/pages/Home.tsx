import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { 
  Flame, Sparkles, Users, Tag as TagIcon, MessageSquare, 
  Search as SearchIcon, ArrowRight, TrendingUp, Compass, Clock, Star
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, where, limit, doc } from "firebase/firestore";
import { safeGetDocs, safeDeleteDoc } from "../lib/firestoreUtils";
import PublicFeedbackCard from "../components/feedback/PublicFeedbackCard";
import CharacterCard from "../components/CharacterCard";
import PromptCard from "../components/PromptCard";
import CreatorCard from "../components/CreatorCard";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { CharacterItem, PromptItem, CreatorItem } from "../types";
import { useAuthStore } from "../store/useAuthStore";
import { useSeo } from "../hooks/useSeo";
import toast from "react-hot-toast";

import { parseIdQuery, lookupIdInFirebase } from "../lib/searchUtils";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  const initialQuery = searchParams.get("q") || "";
  const initialTag = searchParams.get("tag") || null;
  const initialTab = searchParams.get("tab") || "all";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [hotCharacters, setHotCharacters] = useState<CharacterItem[]>([]);
  const [hotPrompts, setHotPrompts] = useState<PromptItem[]>([]);
  const [topCreators, setTopCreators] = useState<CreatorItem[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);
  const [publicFeedbacks, setPublicFeedbacks] = useState<any[]>([]);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  useSeo({
    title: 'Trang Chủ',
    description: 'Thế Giới Nhập Vai AD - Nền tảng cộng đồng dành cho Google AI Studio, nơi bạn có thể khám phá, chia sẻ Character, Prompt và các tài nguyên hữu ích cho Roleplay.'
  });

  useEffect(() => {
    setSearchQuery(searchParams.get("q") || "");
    setSelectedTag(searchParams.get("tag") || null);
    setActiveTab(searchParams.get("tab") || "all");
  }, [searchParams]);

  const loadHomeData = async () => {
    setLoading(true);
    let allChars: CharacterItem[] = [];
    let allPrompts: PromptItem[] = [];

    try {
      // 1. Fetch Characters
      try {
        console.log("Fetching characters...");
        const charSnap = await safeGetDocs(query(collection(db, "characters"), limit(30)));
        console.log(`Fetched ${charSnap.size} characters.`);
        allChars = charSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as CharacterItem))
          .filter(c => !c.deletedAt);

        const sortedChars = [...allChars].sort((a, b) => {
          const scoreA = (a.likesCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
          const scoreB = (b.likesCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
          return scoreB - scoreA;
        });
        setHotCharacters(sortedChars);
      } catch (e) {
        console.log("Notice: Unable to fetch characters (quota/network):", e);
      }

      // 2. Fetch Prompts
      try {
        console.log("Fetching prompts...");
        const promptSnap = await safeGetDocs(query(collection(db, "prompts"), limit(30)));
        console.log(`Fetched ${promptSnap.size} prompts.`);
        allPrompts = promptSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as PromptItem))
          .filter(p => !p.deletedAt);

        const sortedPrompts = [...allPrompts].sort((a, b) => {
          const scoreA = (a.copyCount || 0) * 3 + (a.savesCount || 0) * 2 + (a.viewsCount || 0);
          const scoreB = (b.copyCount || 0) * 3 + (b.savesCount || 0) * 2 + (b.viewsCount || 0);
          return scoreB - scoreA;
        });
        setHotPrompts(sortedPrompts);
      } catch (e) {
        console.log("Notice: Unable to fetch prompts (quota/network):", e);
      }

      // 3. Fetch Top Creators
      try {
        let userSnap;
        try {
          userSnap = await safeGetDocs(query(collection(db, "users"), limit(30)));
        } catch (e) {
          userSnap = await safeGetDocs(query(collection(db, "users"), where("creatorStatus", "==", true), limit(30)));
        }
        const rawCreators: CreatorItem[] = userSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as CreatorItem))
          .filter(u => u.role !== 'ADMIN' && (u.creatorStatus === true || u.role === 'CREATOR' || (u.characterCount && u.characterCount > 0)));

        const sortedCreators = [...rawCreators].sort((a, b) => {
          const scoreA = (a.followerCount || 0) * 5 + (a.characterCount || 0);
          const scoreB = (b.followerCount || 0) * 5 + (b.characterCount || 0);
          return scoreB - scoreA;
        });
        setTopCreators(sortedCreators);
      } catch (e) {
        console.log("Notice: Unable to fetch users/creators (quota/network):", e);
      }

      // 4. Calculate Trending Tags
      const tagMap: Record<string, number> = {};
      allChars.forEach(c => c.tags?.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; }));
      allPrompts.forEach(p => p.tags?.forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; }));

      const sortedTags = Object.entries(tagMap)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      const defaultTags = ["Roleplay", "Anime", "Họcđường", "Fantasy", "Cổđại", "Kinhdị", "Trinhthám", "AIStudio"];
      const finalTags = sortedTags.length > 0 
        ? sortedTags.slice(0, 10) 
        : defaultTags.map(tag => ({ tag, count: 1 }));

      setTrendingTags(finalTags);

      // 5. Fetch Public Feedback
      try {
        console.log("Fetching feedbacks...");
        const fbQuery = query(
          collection(db, "feedbacks"),
          where("mode", "==", "PUBLIC"),
          limit(4)
        );
        const fbSnap = await safeGetDocs(fbQuery);
        console.log(`Fetched ${fbSnap.size} feedbacks.`);
        const fbList = fbSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((f: any) => !f.deletedAt);
        setPublicFeedbacks(fbList);
      } catch (e) {
        console.log("Notice: Unable to fetch feedbacks (quota/network):", e);
      }

      // No mock/fake data fallback to respect "Không Các Sử Dụng Dữ Liệu Ảo"
    } catch (e) {
      console.log("Notice: Home load data error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchQuery.trim();
    if (!queryStr) return;

    const idParse = parseIdQuery(queryStr);
    if (idParse.isIdQuery) {
      if (idParse.error) {
        toast.error(idParse.error);
        navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
        return;
      }

      if (idParse.numericId) {
        try {
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint);
          if (lookup && lookup.found && lookup.path) {
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            navigate(lookup.path);
            return;
          } else {
            const errorMsg = lookup?.error || "Mã ID không tồn tại trên hệ thống.";
            toast.error(errorMsg);
            navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
            return;
          }
        } catch (err) {
          console.error("Exact lookup error in Home page:", err);
          navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
          return;
        }
      }
    }

    const params: Record<string, string> = {};
    if (queryStr) params.q = queryStr;
    if (selectedTag) params.tag = selectedTag;
    if (activeTab && activeTab !== "all") params.tab = activeTab;
    setSearchParams(params);
  };

  const handleTagClick = (tag: string | null) => {
    setSelectedTag(tag);
    const params: Record<string, string> = {};
    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (tag) params.tag = tag;
    if (activeTab && activeTab !== "all") params.tab = activeTab;
    setSearchParams(params);
  };

  // Filter items based on searchQuery & selectedTag
  const filteredCharacters = hotCharacters.filter(item => {
    const nameMatch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (item.slogan || '').toLowerCase().includes(searchQuery.toLowerCase());
    const tagMatch = selectedTag ? item.tags?.includes(selectedTag) : true;
    return (nameMatch || descMatch) && tagMatch;
  });

  const filteredPrompts = hotPrompts.filter(item => {
    const nameMatch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (item.purpose || '').toLowerCase().includes(searchQuery.toLowerCase());
    const tagMatch = selectedTag ? item.tags?.includes(selectedTag) : true;
    return (nameMatch || descMatch) && tagMatch;
  });

  const filteredCreators = topCreators.filter(item => {
    const nameMatch = (item.displayName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (item.bio || '').toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || descMatch;
  });

  return (
    <div className="w-full flex flex-col items-center pb-12">
      
      {/* Hero Banner Section */}
      <section className="w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 py-24 px-6 mt-4 mb-12 text-center max-w-7xl mx-auto relative overflow-hidden">
        {/* Modern decorative elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.05)_0,transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8 border border-neutral-200 dark:border-neutral-700 shadow-sm animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Thế Giới Nhập Vai AD</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight uppercase animate-slide-up text-neutral-900 dark:text-white" style={{ fontFamily: 'Verdana, sans-serif' }}>
            THẾ GIỚI NHẬP VAI AD
          </h1>
          
          <p className="text-neutral-500 dark:text-neutral-400 mb-12 max-w-2xl mx-auto text-base md:text-lg leading-relaxed font-medium opacity-80 animate-slide-up delay-100">
            Nền tảng cộng đồng dành cho Google AI Studio. Tự do khám phá, sáng tạo Character, Prompt và kết nối với các Creator hàng đầu.
          </p>

          {/* Refined Quick Search */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex flex-col md:flex-row items-center gap-3 animate-slide-up delay-200">
            <div className="relative flex-1 w-full">
              <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, thẻ, ID hoặc Creator..." 
                className="w-full pl-14 pr-4 py-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border-none text-neutral-900 dark:text-white placeholder-neutral-400 shadow-inner focus:ring-2 focus:ring-amber-500 transition-all text-sm font-bold"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    handleTagClick(selectedTag);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  Xóa
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button 
                type="submit"
                className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-xs transition-all hover:opacity-90 shadow-xl shadow-black/10 dark:shadow-white/10 active:scale-95"
              >
                Tìm kiếm
              </button>
              <Link 
                to="/ai-search" 
                className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-amber-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors shadow-sm"
                title="AI Search Ngữ Nghĩa"
              >
                <Sparkles className="w-5 h-5" />
              </Link>
            </div>
          </form>
        </div>
      </section>

      <div className="w-full max-w-6xl mx-auto px-4 space-y-16">
        
        {/* SECTION 1: TAG ĐANG PHỔ BIẾN */}
        <section className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TagIcon className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Tag Đang Phổ Biến</h2>
            </div>
            {selectedTag && (
              <button
                onClick={() => handleTagClick(null)}
                className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                Xóa bộ lọc thẻ (#{selectedTag})
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTagClick(null)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedTag === null
                  ? "bg-amber-500 text-black border-amber-500 font-bold"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700/60 hover:bg-amber-500/10"
              }`}
            >
              Tất cả thẻ
            </button>
            {trendingTags.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleTagClick(selectedTag === item.tag ? null : item.tag)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  selectedTag === item.tag
                    ? "bg-amber-500 text-black border-amber-500 font-bold"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/60 dark:border-neutral-700/60 hover:bg-amber-500/10"
                }`}
              >
                <span>#{item.tag}</span>
                <span className="text-[10px] opacity-60 bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.2 rounded-full">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 2: CHARACTER HOT / TẤT CẢ */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-red-500 fill-red-500" />
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Character Nổi Bật</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Các nhân vật có nhiều lượt lưu và yêu thích nhất</p>
            </div>
            <Link to="/characters" className="text-xs font-semibold text-neutral-500 hover:text-black dark:hover:text-white flex items-center gap-1">
              <span>Xem tất cả Character</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="aspect-[3/4] bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredCharacters.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed text-sm">
              Không tìm thấy Character nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredCharacters.slice(0, 10).map(char => (
                <CharacterCard key={char.id} character={char} onUpdate={loadHomeData} />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: PROMPT HOT */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-emerald-500 fill-emerald-500" />
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Prompt Nổi Bật</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Các câu lệnh Prompt có lượt copy và lưu cao nhất từ cộng đồng</p>
            </div>
            <Link to="/prompts" className="text-xs font-semibold text-neutral-500 hover:text-black dark:hover:text-white flex items-center gap-1">
              <span>Xem tất cả Prompt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map(i => <div key={i} className="h-48 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed text-sm">
              Không tìm thấy Prompt nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredPrompts.slice(0, 6).map(prompt => (
                <PromptCard 
                  key={prompt.id} 
                  prompt={prompt} 
                  isOwner={user?.id === prompt.authorId || user?.role === 'ADMIN'}
                  onDelete={(id) => setPromptToDelete(id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 4: CREATOR NỔI BẬT */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-amber-500" />
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Creator Nổi Bật</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Những tác giả Roleplay xuất sắc được đông đảo người dùng theo dõi</p>
            </div>
            <Link to="/creators" className="text-xs font-semibold text-neutral-500 hover:text-black dark:hover:text-white flex items-center gap-1">
              <span>Xem danh sách Creator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-48 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredCreators.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed text-sm">
              Không tìm thấy Creator nào phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {filteredCreators.slice(0, 6).map(creator => (
                <CreatorCard key={creator.id} creator={creator} onUpdate={loadHomeData} />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 5: PUBLIC FEEDBACK */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">Feedback Công Khai Mới</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Các ý kiến đóng góp và trao đổi nổi bật từ các thành viên</p>
            </div>
            <Link to="/feedbacks" className="text-xs font-semibold text-neutral-500 hover:text-black dark:hover:text-white flex items-center gap-1">
              <span>Xem tất cả Feedback</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <div key={i} className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />)}
            </div>
          ) : publicFeedbacks.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-2xl border-dashed text-sm">
              Chưa có Feedback công khai nào.
              <div className="mt-4">
                <Link
                  to="/feedbacks"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-medium rounded-xl hover:opacity-90 transition-opacity"
                >
                  <MessageSquare className="w-4 h-4" />
                  Gửi Feedback đầu tiên
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {publicFeedbacks.map(fb => (
                <PublicFeedbackCard
                  key={fb.id}
                  feedback={fb}
                  onDelete={(id) => setPublicFeedbacks(prev => prev.filter(f => f.id !== id))}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Delete Prompt Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={promptToDelete !== null}
        onClose={() => setPromptToDelete(null)}
        onConfirm={async () => {
          if (!promptToDelete) return;
          try {
            await safeDeleteDoc(doc(db, 'prompts', promptToDelete));
            toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống.");
            loadHomeData();
          } catch (e) {
            toast.error("Không thể xóa Prompt.");
          }
        }}
      />
    </div>
  );
}


