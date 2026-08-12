import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Bookmark, Eye, ExternalLink, Sparkles, User as UserIcon, Tag, MessageSquare, X, Flag } from 'lucide-react';
import { doc, increment, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { safeGetDoc, safeGetDocs, safeAddDoc, safeUpdateDoc, safeDeleteDoc } from '../lib/firestoreUtils';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { CharacterItem } from '../types';
import CommentSection from './comments/CommentSection';
import ReportModal from './ReportModal';
import UserBadge from './UserBadge';
import DisplayId from './DisplayId';
import toast from 'react-hot-toast';

interface CharacterCardProps {
  key?: React.Key;
  character: CharacterItem;
  onUpdate?: () => void;
}

export default function CharacterCard({ character, onUpdate }: CharacterCardProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(character.likesCount || 0);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [savesCount, setSavesCount] = useState(character.savesCount || 0);

  const [viewsCount, setViewsCount] = useState(character.viewsCount || 0);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Check initial like & bookmark state
  useEffect(() => {
    if (!user?.id || !character.id) return;

    const checkInteractions = async () => {
      try {
        // Like check
        const qLike = query(
          collection(db, 'character_likes'),
          where('userId', '==', user.id),
          where('characterId', '==', character.id)
        );
        const snapLike = await safeGetDocs(qLike);
        setIsLiked(!snapLike.empty);

        // Bookmark check
        const qBook = query(
          collection(db, 'bookmarks'),
          where('userId', '==', user.id),
          where('targetId', '==', character.id),
          where('targetType', '==', 'CHARACTER')
        );
        const snapBook = await safeGetDocs(qBook);
        setIsBookmarked(!snapBook.empty);
      } catch (err) {
        console.error("Check interaction error:", err);
      }
    };

    checkInteractions();
  }, [user?.id, character.id]);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Vui lòng đăng nhập để thích Character này!");
      return;
    }

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

        // Gửi thông báo đến Creator
        if (character.creatorId && character.creatorId !== user.id) {
          await safeAddDoc(collection(db, 'notifications'), {
            recipientId: character.creatorId,
            senderId: user.id,
            senderName: user.displayName || 'Người dùng',
            senderAvatar: user.avatar || '',
            type: 'CHARACTER_LIKE',
            title: 'Character được yêu thích',
            message: `${user.displayName || 'Một người dùng'} đã thích Character "${character.name}" của bạn.`,
            targetId: character.id,
            targetType: 'CHARACTER',
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
      if (onUpdate) onUpdate();
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

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu Character này!");
      return;
    }

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

        // Gửi thông báo đến Creator
        if (character.creatorId && character.creatorId !== user.id) {
          await safeAddDoc(collection(db, 'notifications'), {
            recipientId: character.creatorId,
            senderId: user.id,
            senderName: user.displayName || 'Người dùng',
            senderAvatar: user.avatar || '',
            type: 'CHARACTER_SAVE',
            title: 'Character được thêm vào yêu thích/lưu',
            message: `${user.displayName || 'Một người dùng'} đã lưu Character "${character.name}" của bạn vào bộ sưu tập.`,
            targetId: character.id,
            targetType: 'CHARACTER',
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
      if (onUpdate) onUpdate();
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

  const handleOpenDetail = () => {
    navigate(`/character/${character.id}`);
  };

  return (
    <>
      <div 
        onClick={handleOpenDetail}
        className="group cursor-pointer bg-neutral-900 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col w-full h-full border border-neutral-800/50"
      >
        {/* A. Khu vực hình ảnh */}
        <div className="relative w-full aspect-[3/4] overflow-hidden bg-neutral-800 shrink-0">
          <img 
            src={character.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600"} 
            alt={character.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          
          {/* Top Badge */}
          {character.pinned && (
            <div className="absolute top-2 right-2 bg-amber-500 text-black text-[10px] px-2 py-0.5 rounded-sm font-bold flex items-center gap-1 shadow-md z-10 uppercase tracking-wide">
              <Sparkles className="w-3 h-3" />
              Ghim
            </div>
          )}

          {/* C. Khu vực tương tác (Thanh nổi) */}
          <div className="absolute bottom-2 right-2 bg-neutral-700/80 backdrop-blur-md rounded-lg px-2.5 py-1.5 flex items-center gap-3 shadow-lg z-10 transition-opacity">
            <div className="flex items-center gap-1 text-white/90 text-[11px] font-medium">
              <Eye className="w-3.5 h-3.5" />
              <span>{viewsCount}</span>
            </div>
            <button 
              onClick={handleToggleLike}
              className="flex items-center gap-1 hover:text-red-400 transition-colors"
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'text-red-500 fill-current' : 'text-white/90'}`} />
              <span className="text-white/90 text-[11px] font-medium">{likesCount}</span>
            </button>
            <button 
              onClick={handleToggleSave}
              className="flex items-center gap-1 hover:text-amber-400 transition-colors"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'text-amber-500 fill-current' : 'text-white/90'}`} />
              <span className="text-white/90 text-[11px] font-medium">{savesCount}</span>
            </button>
          </div>
        </div>

        {/* B. Khu vực thông tin */}
        <div className="p-4 flex flex-col flex-1 gap-2">
          {/* Tên Character & ID */}
          <div className="flex flex-col gap-0.5">
            <h3 className="text-lg font-bold text-neutral-100 leading-snug break-words">
              {character.name}
            </h3>
            <div className="mt-0.5">
              <DisplayId type="character" numericId={character.numericId} fallbackId={character.id} className="bg-neutral-800/80 border-neutral-700/60 text-neutral-400 text-[10px]" />
            </div>
          </div>

          {/* Tên Creator */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              if (character.creatorId) navigate(`/creator/${character.creatorId}`);
            }}
            className="flex items-center gap-2 group/creator cursor-pointer w-fit mt-1"
          >
            <img 
              src={character.creatorAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=creator"} 
              className="w-4 h-4 rounded-full object-cover"
              alt=""
            />
            <span className="text-xs font-medium text-neutral-400 group-hover/creator:text-white transition-colors truncate max-w-[160px]">
              {character.creatorName}
            </span>
          </div>
          
          {/* Câu Slogan */}
          <p className="text-neutral-400 text-sm line-clamp-3 leading-relaxed mt-1">
            {character.slogan}
          </p>

          <div className="flex-1"></div>

          {/* D. Khu vực tag */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {character.gender && (
              <span className="px-2.5 py-1 bg-neutral-800 text-white rounded-full text-[10px] font-medium whitespace-nowrap">
                {character.gender}
              </span>
            )}
            {character.tags?.map((tag, i) => (
              <span key={i} className="px-2.5 py-1 bg-neutral-800 text-white rounded-full text-[10px] font-medium whitespace-nowrap">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="CHARACTER"
        targetId={character.id}
        targetName={character.name}
      />
    </>
  );
}
