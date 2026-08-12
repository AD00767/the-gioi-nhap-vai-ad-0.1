import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, UserCheck, UserPlus, Users, BookOpen, PenTool, ArrowLeft, Flag, AlertCircle, RefreshCw,
  Facebook, Instagram, Music, MessageSquare, ExternalLink
} from 'lucide-react';
import { doc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { safeGetDoc, safeGetDocs } from '../lib/firestoreUtils';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { CreatorItem, CharacterItem, PromptItem } from '../types';
import { useSeo } from '../hooks/useSeo';
import CharacterCard from '../components/CharacterCard';
import PromptCard from '../components/PromptCard';
import ReportModal from '../components/ReportModal';
import UserBadge from '../components/UserBadge';
import DisplayId from '../components/DisplayId';
import toast from 'react-hot-toast';
import { checkIsFollowing, toggleFollow, reconcileFollowerCount } from '../lib/followService';

export default function CreatorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [creator, setCreator] = useState<CreatorItem | null>(null);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'CHARACTERS' | 'PROMPTS'>('CHARACTERS');

  const [isReportOpen, setIsReportOpen] = useState(false);

  useSeo({
    title: creator?.displayName,
    description: creator?.bio,
    image: creator?.avatar,
    type: 'profile'
  });

  const fetchCreatorData = async () => {
    if (!id) return;
    setLoading(true);
    setError(false);

    try {
      // 1. Fetch user doc
      const userRef = doc(db, 'users', id);
      const userSnap = await safeGetDoc(userRef);

      // Allow any user who is not deleted
      if (!userSnap.exists()) {
        setError(true);
        return;
      }

      const userData = userSnap.data();
      if (userData.deletedAt) {
        setError(true);
        return;
      }

      const cItem = { id: userSnap.id, ...userData } as CreatorItem;
      setCreator(cItem);

      // Reconcile and get exact database follower count
      const exactFollowerCount = await reconcileFollowerCount(id);
      setFollowerCount(exactFollowerCount);

      document.title = `${cItem.displayName} - Creator Profile | Thế giới nhập vai_AD`;

      // 2. Fetch Creator's characters
      const qChar = query(collection(db, 'characters'), where('creatorId', '==', id));
      const snapChar = await safeGetDocs(qChar);
      const charList: CharacterItem[] = [];
      let totalLikesReceived = 0;
      let totalSavesReceived = 0;
      let totalViewsReceived = 0;

      snapChar.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt) {
          const item = { id: d.id, ...data } as CharacterItem;
          charList.push(item);
          totalLikesReceived += Number(data.likesCount || 0);
          totalSavesReceived += Number(data.savesCount || 0);
          totalViewsReceived += Number(data.viewsCount || 0);
        }
      });
      // Sort pinned first, then newest
      charList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setCharacters(charList);
      
      // Set default tab to PROMPTS if no characters and it's a regular user
      if (charList.length === 0) {
        setActiveTab('PROMPTS');
      }

      // Update creator object with fresh sums for UserBadge and SEO
      setCreator(prev => prev ? { 
        ...prev, 
        totalLikes: totalLikesReceived, 
        totalSaves: totalSavesReceived,
        viewsCount: totalViewsReceived
      } : null);

      // 3. Fetch Creator's prompts
      const qPrompt = query(collection(db, 'prompts'), where('authorId', '==', id));
      const snapPrompt = await safeGetDocs(qPrompt);
      const promptList: PromptItem[] = [];
      snapPrompt.docs.forEach(d => {
        const data = d.data();
        if (!data.deletedAt) promptList.push({ id: d.id, ...data } as PromptItem);
      });
      // Sort pinned first, then newest
      promptList.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      setPrompts(promptList);

    } catch (err) {
      console.error("Fetch creator error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Check follow status
  useEffect(() => {
    if (!user?.id || !id || user.id === id) return;

    const checkFollow = async () => {
      try {
        const hasFollow = await checkIsFollowing(user.id, id);
        setIsFollowing(hasFollow);
      } catch (e) {
        console.error("Check follow error:", e);
      }
    };

    checkFollow();
  }, [user?.id, id]);

  useEffect(() => {
    fetchCreatorData();
  }, [id]);

  const handleToggleFollow = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để theo dõi Creator!");
      return;
    }
    if (!creator || user.id === creator.id) {
      toast.error("Bạn không thể tự theo dõi chính mình!");
      return;
    }

    setFollowLoading(true);
    try {
      const res = await toggleFollow(user.id, creator.id, {
        displayName: user.displayName,
        avatar: user.photoURL || user.avatar
      });

      if (res.success) {
        setIsFollowing(res.following);
        setFollowerCount(res.followerCount);
        toast.success(res.message || (res.following ? `Đã theo dõi ${creator.displayName}` : `Đã hủy theo dõi ${creator.displayName}`));
      } else {
        toast.error(res.message || "Thao tác thất bại.");
      }
    } catch (e) {
      console.error("Toggle follow error:", e);
      toast.error("Thao tác thất bại.");
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Nội dung này không còn khả dụng
        </h2>
        <p className="text-neutral-500 text-sm max-w-md mx-auto">
          Trang Creator này không tồn tại hoặc đã bị khóa.
        </p>
        <button
          onClick={() => navigate('/creators')}
          className="mt-4 px-6 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Khám phá Creator khác
        </button>
      </div>
    );
  }

  const isSelf = user?.id === creator.id;
  const pinnedCharacters = characters.filter(c => c.pinned);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại</span>
      </button>

      {/* Creator Profile Hero Banner */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-neutral-200/50 dark:shadow-none space-y-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-500" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-500" />
        
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
            <div className="relative shrink-0">
              <img 
                src={creator.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.displayName}`} 
                alt={creator.displayName}
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-white dark:border-neutral-800 shadow-2xl ring-1 ring-neutral-200 dark:ring-neutral-700 transition-transform duration-500 group-hover:scale-105"
              />
              {creator.creatorStatus && (
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-neutral-900">
                  <Sparkles className="w-4 h-4 fill-white" />
                </div>
              )}
            </div>

            <div className="space-y-4 max-w-2xl">
              <div className="space-y-1">
                <div className="flex flex-col md:flex-row items-center md:items-baseline gap-3">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 font-display">
                    {creator.displayName}
                  </h1>
                  <UserBadge 
                    subject={{ 
                      creatorStatus: creator.creatorStatus,
                      role: creator.role,
                      createdAt: creator.createdAt,
                      characterCount: characters.length, 
                      promptCount: prompts.length,
                      totalLikes: creator.totalLikes || 0,
                      totalSaves: creator.totalSaves || 0,
                      viewsCount: creator.viewsCount || 0
                    }} 
                    size="md"
                  />
                </div>
                {creator.role !== 'ADMIN' && creator.role !== 'MODERATOR' && (
                  <div className="flex justify-center md:justify-start">
                    <DisplayId type="creator" numericId={creator.numericId} fallbackId={creator.id} />
                  </div>
                )}
                {creator.statusMessage && (
                  <div className="mt-1.5 flex justify-center md:justify-start">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold shadow-sm animate-fade-in">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>{creator.statusMessage}</span>
                    </span>
                  </div>
                )}
              </div>

              <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium italic">
                "{creator.bio || (creator.creatorStatus 
                  ? "Tác giả sáng tạo nhân vật Roleplay và Prompt trên Google AI Studio." 
                  : "Thành viên cộng đồng Thế giới nhập vai_AD.")}"
              </p>

              {/* Social links */}
              {creator.socialLinks && (
                creator.socialLinks.facebook || 
                creator.socialLinks.instagram || 
                creator.socialLinks.tiktok || 
                creator.socialLinks.discord || 
                (creator.socialLinks.customLinks && creator.socialLinks.customLinks.length > 0)
              ) && (
                <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                  {creator.socialLinks.facebook && (
                    <a 
                      href={creator.socialLinks.facebook.startsWith('http') ? creator.socialLinks.facebook : `https://${creator.socialLinks.facebook}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-white hover:bg-blue-600 transition-all duration-300 shadow-sm"
                      title="Facebook"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                  {creator.socialLinks.instagram && (
                    <a 
                      href={creator.socialLinks.instagram.startsWith('http') ? creator.socialLinks.instagram : `https://${creator.socialLinks.instagram}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-white hover:bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 transition-all duration-300 shadow-sm"
                      title="Instagram"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {creator.socialLinks.tiktok && (
                    <a 
                      href={creator.socialLinks.tiktok.startsWith('http') ? creator.socialLinks.tiktok : `https://${creator.socialLinks.tiktok}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-white hover:bg-black dark:hover:bg-neutral-700 transition-all duration-300 shadow-sm"
                      title="TikTok"
                    >
                      <Music className="w-4 h-4" />
                    </a>
                  )}
                  {creator.socialLinks.discord && (
                    <a 
                      href={creator.socialLinks.discord.startsWith('http') ? creator.socialLinks.discord : `https://${creator.socialLinks.discord}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-white hover:bg-indigo-600 transition-all duration-300 shadow-sm"
                      title="Discord"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                  )}
                  {creator.socialLinks.customLinks && creator.socialLinks.customLinks.map((link: any, idx: number) => {
                    if (!link.label || !link.url) return null;
                    const formattedUrl = link.url.startsWith('http') ? link.url : `https://${link.url}`;
                    return (
                      <a 
                        key={idx} 
                        href={formattedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1 px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-all shadow-sm border border-neutral-200/40 dark:border-neutral-700/60"
                        title={link.label}
                      >
                        <span>{link.label}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-3 w-full md:w-auto">
            {!isSelf && (
              <button
                onClick={handleToggleFollow}
                disabled={followLoading}
                className={`w-full md:w-48 px-6 py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${
                  isFollowing
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                    : 'bg-black dark:bg-white text-white dark:text-black hover:scale-105 active:scale-95'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-5 h-5 text-emerald-500" />
                    <span>Đang theo dõi</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Theo dõi Creator</span>
                  </>
                )}
              </button>
            )}

            {!isSelf && (
              <button
                onClick={() => setIsReportOpen(true)}
                className="w-full md:w-auto p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-all duration-300 flex items-center justify-center gap-2"
                title="Báo cáo Creator"
              >
                <Flag className="w-5 h-5" />
                <span className="md:hidden text-xs font-bold">Báo cáo Creator</span>
              </button>
            )}
          </div>
        </div>

        {/* Creator Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 p-8 bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl border border-neutral-100 dark:border-neutral-800 text-center shadow-inner">
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Characters</div>
            <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-display">{characters.length}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Prompts</div>
            <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-display">{prompts.length}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Lượt thích</div>
            <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-display">{creator.totalLikes || 0}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Lượt lưu</div>
            <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-display">{creator.totalSaves || 0}</div>
          </div>
          <div className="col-span-2 md:col-span-1 space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Followers</div>
            <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-display">{followerCount}</div>
          </div>
        </div>
      </div>

      {/* Pinned Characters Section (if any) */}
      {pinnedCharacters.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>Character Nổi Bật Được Ghim ({pinnedCharacters.length}/3)</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {pinnedCharacters.map(c => (
              <CharacterCard key={c.id} character={c} onUpdate={fetchCreatorData} />
            ))}
          </div>
        </div>
      )}

      {/* Tabs Selection: Characters vs Prompts */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('CHARACTERS')}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'CHARACTERS'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Danh Sách Character ({characters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('PROMPTS')}
          className={`pb-3 text-sm font-extrabold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'PROMPTS'
              ? 'border-black dark:border-white text-black dark:text-white'
              : 'border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>Danh Sách Prompt ({prompts.length})</span>
        </button>
      </div>

      {/* Tab Content Display */}
      {activeTab === 'CHARACTERS' ? (
        characters.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 space-y-2">
            <p className="text-neutral-500 text-sm">Creator chưa đăng Character nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {characters.map(c => (
              <CharacterCard key={c.id} character={c} onUpdate={fetchCreatorData} />
            ))}
          </div>
        )
      ) : (
        prompts.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 space-y-2">
            <p className="text-neutral-500 text-sm">Creator chưa đăng Prompt nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prompts.map(p => (
              <PromptCard 
                key={p.id} 
                prompt={p} 
                isOwner={user?.id === p.authorId || user?.role === 'ADMIN'} 
               onDelete={async (promptId) => {
                  if (!confirm("Bạn có chắc chắn muốn xóa hoàn toàn Prompt này không? Hành động này không thể hoàn tác và Prompt sẽ biến mất ngay lập tức khỏi hệ thống.")) return;
                  try {
                    const { doc, deleteDoc } = await import('firebase/firestore');
                    await deleteDoc(doc(db, 'prompts', promptId));
                    toast.success("Đã xóa hoàn toàn Prompt khỏi hệ thống.");
                    fetchCreatorData();
                  } catch (e) {
                    toast.error("Không thể xóa Prompt.");
                  }
                }}
              />
            ))}
          </div>
        )
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="CREATOR"
        targetId={creator.id}
        targetName={creator.displayName}
      />
    </div>
  );
}
