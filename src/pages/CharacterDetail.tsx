import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Heart, Bookmark, Eye, ExternalLink, Sparkles, User as UserIcon, Tag, MessageSquare, ArrowLeft, Flag, AlertCircle, Trash2, PenTool, Copy, Quote, X
} from 'lucide-react';
import { doc, increment, collection, query, where, serverTimestamp, limit } from 'firebase/firestore';
import { safeGetDoc, safeGetDocs, safeAddDoc, safeUpdateDoc, safeDeleteDoc } from '../lib/firestoreUtils';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { CharacterItem } from '../types';
import { useSeo } from '../hooks/useSeo';
import CommentSection from '../components/comments/CommentSection';
import ReportModal from '../components/ReportModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import CharacterCard from '../components/CharacterCard';
import DisplayId from '../components/DisplayId';
import UserBadge from '../components/UserBadge';
import toast from 'react-hot-toast';

export default function CharacterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [character, setCharacter] = useState<CharacterItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [savesCount, setSavesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [relatedCharacters, setRelatedCharacters] = useState<CharacterItem[]>([]);

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  useSeo({
    title: character?.name,
    description: character?.slogan,
    image: character?.avatar,
    type: 'article'
  });

  const fetchCharacter = async () => {
    if (!id) return;
    setLoading(true);
    setError(false);

    try {
      const docRef = doc(db, 'characters', id);
      const snap = await safeGetDoc(docRef);

      if (!snap.exists()) {
        setError(true);
        return;
      }

      const data = snap.data();
      if (data.deletedAt) {
        setError(true);
        return;
      }

      const item = { id: snap.id, ...data } as CharacterItem;
      setCharacter(item);
      setLikesCount(item.likesCount || 0);
      setSavesCount(item.savesCount || 0);
      setCommentsCount(item.commentsCount || 0);

      // Requirement 18 & 19: View count with throttle
      const storageKey = `vviewed_char_${id}`;
      const lastViewed = localStorage.getItem(storageKey);
      const now = Date.now();
      const throttleTime = 5 * 60 * 1000; // 5 minutes

      if (!lastViewed || (now - parseInt(lastViewed, 10)) > throttleTime) {
        setViewsCount((item.viewsCount || 0) + 1);
        localStorage.setItem(storageKey, now.toString());
        try {
          await safeUpdateDoc(docRef, { viewsCount: increment(1) });
        } catch (e) {
          console.error("View count update error:", e);
        }
      } else {
        setViewsCount(item.viewsCount || 0);
      }

      // Update document title for SEO & Social Link Preview
      document.title = `${item.name} - Character Roleplay | Thế giới nhập vai_AD`;

      // Fetch related characters (by same creator or tags)
      fetchRelated(item);
    } catch (err) {
      console.error("Fetch character detail error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelated = async (currentChar: CharacterItem) => {
    try {
      const q = query(collection(db, 'characters'), limit(100));
      const snap = await safeGetDocs(q);
      const list: CharacterItem[] = [];

      snap.docs.forEach(d => {
        const data = d.data();
        if (d.id !== currentChar.id && !data.deletedAt) {
          list.push({ id: d.id, ...data } as CharacterItem);
        }
      });

      // Filter by same creator or tag match
      const related = list.filter(c => 
        c.creatorId === currentChar.creatorId ||
        c.tags?.some(t => currentChar.tags?.includes(t))
      ).slice(0, 3);

      setRelatedCharacters(related);
    } catch (e) {
      console.error("Fetch related characters error:", e);
    }
  };

  // Check initial likes & bookmarks
  useEffect(() => {
    if (!user?.id || !id) return;

    const checkInteractions = async () => {
      try {
        const qLike = query(
          collection(db, 'character_likes'),
          where('userId', '==', user.id),
          where('characterId', '==', id)
        );
        const snapLike = await safeGetDocs(qLike);
        setIsLiked(!snapLike.empty);

        const qBook = query(
          collection(db, 'bookmarks'),
          where('userId', '==', user.id),
          where('targetId', '==', id),
          where('targetType', '==', 'CHARACTER')
        );
        const snapBook = await safeGetDocs(qBook);
        setIsBookmarked(!snapBook.empty);
      } catch (e) {
        console.error("Check interaction error:", e);
      }
    };

    checkInteractions();
  }, [user?.id, id]);

  useEffect(() => {
    fetchCharacter();
  }, [id]);

  const handleToggleLike = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để thích Character!");
      return;
    }
    if (!character) return;

    try {
      const q = query(
        collection(db, 'character_likes'),
        where('userId', '==', user.id),
        where('characterId', '==', character.id)
      );
      const snap = await safeGetDocs(q);
      const charRef = doc(db, 'characters', character.id);

      if (!snap.empty) {
        for (const d of snap.docs) {
          await safeDeleteDoc(doc(db, 'character_likes', d.id));
        }
        await safeUpdateDoc(charRef, { likesCount: increment(-1) });
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await safeAddDoc(collection(db, 'character_likes'), {
          userId: user.id,
          characterId: character.id,
          createdAt: serverTimestamp()
        });
        await safeUpdateDoc(charRef, { likesCount: increment(1) });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        toast.success("Đã thích Character!");
      }
    } catch (err) {
      console.error("Toggle like error:", err);
      const errStr = err instanceof Error ? err.message : String(err);
      if (errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('limit') || errStr.toLowerCase().includes('exceeded') || errStr.toLowerCase().includes('permission-denied')) {
        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);
        toast.success(isLiked ? "Đã bỏ thích!" : "Đã thích Character!");
        toast.error("Hạn ngạch cơ sở dữ liệu đã hết hôm nay. Đã thực hiện thay đổi cục bộ tạm thời.");
      } else {
        toast.error("Thao tác thất bại.");
      }
    }
  };

  const handleToggleSave = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu Character!");
      return;
    }
    if (!character) return;

    try {
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', user.id),
        where('targetId', '==', character.id),
        where('targetType', '==', 'CHARACTER')
      );
      const snap = await safeGetDocs(q);
      const charRef = doc(db, 'characters', character.id);

      if (!snap.empty) {
        for (const d of snap.docs) {
          await safeDeleteDoc(doc(db, 'bookmarks', d.id));
        }
        await safeUpdateDoc(charRef, { savesCount: increment(-1) });
        setIsBookmarked(false);
        setSavesCount(prev => Math.max(0, prev - 1));
      } else {
        await safeAddDoc(collection(db, 'bookmarks'), {
          userId: user.id,
          targetId: character.id,
          targetType: 'CHARACTER',
          createdAt: serverTimestamp()
        });
        await safeUpdateDoc(charRef, { savesCount: increment(1) });
        setIsBookmarked(true);
        setSavesCount(prev => prev + 1);
        toast.success("Đã lưu Character vào bộ sưu tập!");
      }
    } catch (err) {
      console.error("Toggle save error:", err);
      const errStr = err instanceof Error ? err.message : String(err);
      if (errStr.toLowerCase().includes('quota') || errStr.toLowerCase().includes('limit') || errStr.toLowerCase().includes('exceeded') || errStr.toLowerCase().includes('permission-denied')) {
        setIsBookmarked(!isBookmarked);
        setSavesCount(prev => isBookmarked ? Math.max(0, prev - 1) : prev + 1);
        toast.success(isBookmarked ? "Đã bỏ lưu Character!" : "Đã lưu Character vào bộ sưu tập!");
        toast.error("Hạn ngạch cơ sở dữ liệu đã hết hôm nay. Đã thực hiện thay đổi cục bộ tạm thời.");
      } else {
        toast.error("Thao tác thất bại.");
      }
    }
  };

  const isOwnerOrStaff = Boolean(
    user && (
      user.id === character?.creatorId || 
      user.role === 'ADMIN' || 
      user.role === 'MODERATOR' || 
      user.role === 'MOD'
    )
  );

  const handleDeleteCharacter = async () => {
    if (!character) return;

    try {
      const charRef = doc(db, 'characters', character.id);
      await safeUpdateDoc(charRef, { deletedAt: new Date().toISOString() });
      toast.success("Đã xóa Character.");
      navigate('/characters');
    } catch (err) {
      console.error("Delete character error:", err);
      toast.error("Không thể xóa Character.");
    }
  };

  const handleCopyId = () => {
    if (character?.numericId) {
      navigator.clipboard.writeText(character.numericId);
      toast.success("Đã sao chép ID Character");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
        <div className="h-80 bg-neutral-100 dark:bg-neutral-800 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Nội dung này không còn khả dụng
        </h2>
        <p className="text-neutral-500 text-sm max-w-md mx-auto">
          Character này có thể đã bị tác giả xoá, hoặc đường dẫn không đúng.
        </p>
        <button
          onClick={() => navigate('/characters')}
          className="mt-4 px-6 py-2.5 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-32 animate-fade-in">
      {/* Back Button */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
        
        <div className="flex items-center gap-4">
          {isOwnerOrStaff && (
            <button onClick={() => setIsDeleteModalOpen(true)} className="text-neutral-400 hover:text-red-500 transition-colors" title="Xóa Character">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => setIsReportOpen(true)} className="text-neutral-400 hover:text-red-500 transition-colors" title="Báo cáo">
            <Flag className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 1. Header Info */}
      <div className="flex flex-col items-center text-center space-y-4 mb-8">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] overflow-hidden shadow-2xl">
          <img src={character.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800"} alt={character.name} className="w-full h-full object-cover" />
        </div>
        
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tighter">
            {character.name}
          </h1>
          <div className="flex items-center justify-center pt-1">
            <DisplayId type="character" numericId={character.numericId} fallbackId={character.id} />
          </div>
          <Link to={`/creator/${character.creatorId}`} className="text-sm font-bold text-neutral-400 hover:text-amber-500 transition-colors uppercase tracking-widest mt-1 block">
            BY {character.creatorName}
          </Link>
        </div>

        <div className="flex items-center gap-6 text-neutral-400 text-xs font-bold uppercase tracking-widest pt-2">
          <div className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> {viewsCount.toLocaleString()}</div>
          <div className="flex items-center gap-1.5"><Heart className="w-4 h-4" /> {likesCount.toLocaleString()}</div>
          <div className="flex items-center gap-1.5"><Bookmark className="w-4 h-4" /> {savesCount.toLocaleString()}</div>
        </div>
      </div>

      {/* 2. Tabs */}
      <div className="flex items-center justify-center gap-8 mb-8 bg-neutral-900 rounded-2xl pt-4 px-4 border-none">
        <button 
          onClick={() => setActiveTab('details')}
          className={`relative pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'details' ? 'text-white' : 'text-neutral-500 hover:text-neutral-400'}`}
        >
          Chi tiết Character
          {activeTab === 'details' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('comments')}
          className={`relative pb-4 text-sm font-bold uppercase tracking-widest transition-colors ${activeTab === 'comments' ? 'text-white' : 'text-neutral-500 hover:text-neutral-400'}`}
        >
          Bình luận <span className="ml-1 opacity-50">({commentsCount})</span>
          {activeTab === 'comments' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-t-full"></div>}
        </button>
      </div>

      {activeTab === 'details' ? (
        <div className="space-y-8">
          {/* 3. Info Card */}
          <div className="bg-neutral-100 dark:bg-neutral-900 rounded-[2rem] p-8 md:p-10 shadow-sm text-center relative overflow-hidden">
            <Quote className="w-10 h-10 text-neutral-200 dark:text-neutral-800 mx-auto mb-4" />
            <p className="text-xl md:text-2xl font-medium text-neutral-800 dark:text-neutral-200 italic leading-relaxed relative z-10">
              "{character.slogan}"
            </p>
          </div>

          {/* 4. Tags */}
          {((character.tags && character.tags.length > 0) || character.gender) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
               {character.gender && (
                  <span className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider">
                    {character.gender}
                  </span>
               )}
               {character.tags?.map(tag => (
                 <span key={tag} className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl text-xs font-bold uppercase tracking-wider">
                   #{tag}
                 </span>
               ))}
            </div>
          )}

          {/* 5. Divider */}
          <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800 my-8"></div>

          {/* 6. Creator Note */}
          {character.notes && (
            <div className="space-y-3">
               <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest text-center">Creator Note</h3>
               <div className="bg-neutral-100 dark:bg-neutral-900 rounded-[1.5rem] p-6 text-neutral-600 dark:text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
                 {character.notes}
               </div>
            </div>
          )}

          {/* 7. Plot */}
          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tighter text-center">Cốt truyện</h3>
            <div className="text-neutral-700 dark:text-neutral-300 text-base leading-relaxed whitespace-pre-wrap text-justify">
              {character.plot}
            </div>
          </div>

          {/* 8. Opening Scene */}
          {character.openingScene && (
            <div className="space-y-4 pt-8">
              <h3 className="text-lg font-black text-neutral-900 dark:text-white uppercase tracking-tighter text-center">Cảnh mở đầu</h3>
              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-[1.5rem] p-6 text-neutral-700 dark:text-neutral-300 text-base leading-relaxed whitespace-pre-wrap italic border border-neutral-100 dark:border-neutral-800">
                {character.openingScene}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-[2rem] p-6 md:p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
          <CommentSection
            targetId={character.id}
            targetType="CHARACTER"
            targetTitle={character.name}
            targetOwnerId={character.creatorId}
          />
        </div>
      )}

      {/* 9. Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-800 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          {/* Nút Lưu */}
          <button 
            onClick={handleToggleSave}
            className={`flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl transition-all bg-neutral-900 hover:bg-black ${isBookmarked ? 'text-amber-500' : 'text-neutral-400 hover:text-white'}`}
          >
            <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
          
          {/* Nút Mở Character */}
          {(() => {
            let urls: string[] = [];
            if (character.links && character.links.length > 0) {
              urls = character.links;
            } else if (character.characterLink || character.link) {
              urls = [character.characterLink || character.link || ''];
            }
            urls = urls.filter(u => u && u.trim() !== '');

            if (urls.length === 0) {
              return (
                <button 
                  disabled
                  className="flex-1 h-14 flex items-center justify-center gap-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 rounded-[2rem] font-black uppercase tracking-widest text-sm shadow-sm cursor-not-allowed"
                >
                  Chưa Có Link
                </button>
              );
            } else if (urls.length === 1) {
              const url = urls[0].startsWith('http') ? urls[0] : `https://${urls[0]}`;
              return (
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 h-14 flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black rounded-[2rem] font-black uppercase tracking-widest text-sm hover:opacity-90 active:scale-95 transition-all shadow-xl"
                >
                  Mở Character
                </a>
              );
            } else {
              return (
                <button 
                  onClick={() => setIsLinkModalOpen(true)}
                  className="flex-1 h-14 flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black rounded-[2rem] font-black uppercase tracking-widest text-sm hover:opacity-90 active:scale-95 transition-all shadow-xl"
                >
                  Mở Character ({urls.length})
                </button>
              );
            }
          })()}
          
          {/* Nút Yêu thích */}
          <button 
            onClick={handleToggleLike}
            className={`flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl transition-all bg-neutral-900 hover:bg-black ${isLiked ? 'text-red-500' : 'text-neutral-400 hover:text-white'}`}
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="CHARACTER"
        targetId={character.id}
        targetName={character.name}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteCharacter}
        title="Xóa Character"
        description="Bạn có chắc chắn muốn xóa Character này không? Hành động này không thể hoàn tác và Character sẽ biến mất ngay lập tức khỏi hệ thống."
      />

      {/* Multiple Links Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsLinkModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-6">
              <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900 dark:text-white mb-2">
                Chọn Phiên Bản
              </h3>
              <p className="text-sm text-neutral-500">
                Character này có nhiều phiên bản. Vui lòng chọn một phiên bản để mở.
              </p>
            </div>

            <div className="space-y-3">
              {(() => {
                let urls: string[] = [];
                if (character.links && character.links.length > 0) {
                  urls = character.links;
                } else if (character.characterLink || character.link) {
                  urls = [character.characterLink || character.link || ''];
                }
                urls = urls.filter(u => u && u.trim() !== '');

                return urls.map((url, idx) => {
                  const finalUrl = url.startsWith('http') ? url : `https://${url}`;
                  return (
                    <a
                      key={idx}
                      href={finalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <ExternalLink className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                          Phiên bản {idx + 1}
                        </div>
                        <div className="text-xs text-neutral-500 truncate">
                          {url.replace(/^https?:\/\//, '')}
                        </div>
                      </div>
                    </a>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
