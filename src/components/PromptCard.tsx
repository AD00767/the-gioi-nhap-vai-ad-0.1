import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Copy, Check, Bookmark, BookmarkCheck, Pin, Edit3, Trash2, User as UserIcon, Sparkles, MessageSquare, Flag
} from 'lucide-react';
import { 
  doc, updateDoc, increment, collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  safeGetDocs, safeAddDoc, safeDeleteDoc, safeUpdateDoc 
} from '../lib/firestoreUtils';
import { useAuthStore } from '../store/useAuthStore';
import { PromptItem } from '../types';
import CommentSection from './comments/CommentSection';
import ReportModal from './ReportModal';
import UserBadge from './UserBadge';
import DisplayId from './DisplayId';
import toast from 'react-hot-toast';

interface PromptCardProps {
  key?: React.Key;
  prompt: PromptItem;
  onEdit?: (prompt: PromptItem) => void;
  onDelete?: (promptId: string) => void;
  onPin?: (prompt: PromptItem) => void;
  isOwner?: boolean;
}

export default function PromptCard({ prompt, onEdit, onDelete, onPin, isOwner }: PromptCardProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(prompt.copyCount || 0);
  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [savesCount, setSavesCount] = useState(prompt.savesCount || 0);
  const [bookmarking, setBookmarking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const isPinned = prompt.pinned || false;

  // Check initial bookmark status for current user
  useEffect(() => {
    if (!user?.id || !prompt.id) return;
    const checkBookmark = async () => {
      try {
        const q = query(
          collection(db, 'bookmarks'),
          where('userId', '==', user.id),
          where('targetId', '==', prompt.id),
          where('targetType', '==', 'PROMPT')
        );
        const snap = await safeGetDocs(q);
        setIsBookmarked(!snap.empty);
      } catch (e) {
        console.error("Check bookmark error:", e);
      }
    };
    checkBookmark();
  }, [user?.id, prompt.id]);

  // Quick Copy Handler ("Sao chép nhanh")
  const handleQuickCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      toast.success("Đã sao chép Prompt vào khay nhớ tạm!");

      // Update Firestore copy count
      try {
        const promptRef = doc(db, 'prompts', prompt.id);
        await safeUpdateDoc(promptRef, {
          copyCount: increment(1)
        });
      } catch (dbErr) {
        console.log("Could not update copyCount in db:", dbErr);
      }
      setCopyCount(prev => prev + 1);

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Không thể sao chép nội dung.");
    }
  };

  // Save / Bookmark Handler ("Nút lưu" & "Bộ đếm số lượt lưu")
  const handleToggleSave = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu Prompt này!");
      return;
    }

    setBookmarking(true);
    try {
      const q = query(
        collection(db, 'bookmarks'),
        where('userId', '==', user.id),
        where('targetId', '==', prompt.id),
        where('targetType', '==', 'PROMPT')
      );
      const snap = await safeGetDocs(q);

      const promptRef = doc(db, 'prompts', prompt.id);

      if (!snap.empty) {
        // Remove bookmark
        for (const bDoc of snap.docs) {
          await safeDeleteDoc(doc(db, 'bookmarks', bDoc.id));
        }
        try {
          await safeUpdateDoc(promptRef, {
            savesCount: increment(-1)
          });
        } catch (dbErr) {
          console.log("Could not update savesCount in db:", dbErr);
        }
        setIsBookmarked(false);
        setSavesCount(prev => Math.max(0, prev - 1));
        toast.success("Đã bỏ lưu Prompt.");
      } else {
        // Add bookmark
        await safeAddDoc(collection(db, 'bookmarks'), {
          userId: user.id,
          targetId: prompt.id,
          targetType: 'PROMPT',
          createdAt: serverTimestamp()
        });
        try {
          await safeUpdateDoc(promptRef, {
            savesCount: increment(1)
          });
        } catch (dbErr) {
          console.log("Could not update savesCount in db:", dbErr);
        }
        setIsBookmarked(true);
        setSavesCount(prev => prev + 1);
        toast.success("Đã lưu Prompt vào bộ sưu tập!");

        // Gửi thông báo đến Tác giả Prompt
        if (prompt.authorId && prompt.authorId !== user.id) {
          try {
            await safeAddDoc(collection(db, 'notifications'), {
              recipientId: prompt.authorId,
              senderId: user.id,
              senderName: user.displayName || 'Người dùng',
              senderAvatar: user.avatar || '',
              type: 'PROMPT_SAVE',
              title: 'Prompt được lưu vào bộ sưu tập',
              message: `${user.displayName || 'Một người dùng'} đã lưu Prompt "${prompt.name || prompt.title || 'Prompt'}" của bạn vào bộ sưu tập.`,
              targetId: prompt.id,
              targetType: 'PROMPT',
              read: false,
              createdAt: new Date().toISOString()
            });
          } catch (notifErr) {
            console.log("Could not create notification for prompt bookmark:", notifErr);
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Thao tác lưu thất bại.");
    } finally {
      setBookmarking(false);
    }
  };

  const handleNavigateDetail = () => {
    navigate(`/prompt/${prompt.id}`);
  };

  return (
    <div 
      onClick={handleNavigateDetail}
      className={`bg-white dark:bg-neutral-900 border-[1px] rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between gap-5 cursor-pointer group ${
      isPinned 
        ? 'border-amber-500/30 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/[0.02]' 
        : 'border-neutral-200 dark:border-neutral-800'
    }`}>
      <div className="space-y-4">
        {/* Header line: Title, Pinned badge, Author */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-lg text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-amber-500 transition-colors uppercase tracking-tight">
                {prompt.name || prompt.title || 'Prompt'}
              </h3>
              {isPinned && (
                <span className="px-2.5 py-1 bg-amber-500 text-white border-none rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 flex items-center gap-1">
                  <Pin className="w-2.5 h-2.5 fill-white" /> Ghim
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <DisplayId type="prompt" numericId={prompt.numericId} fallbackId={prompt.id} className="bg-neutral-100 dark:bg-neutral-800 border-none text-neutral-400 text-[9px]" />
            </div>

            {/* Author Name */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              {prompt.authorId ? (
                <div 
                  onClick={(e) => { e.stopPropagation(); navigate(`/creator/${prompt.authorId}`); }}
                  className="flex items-center gap-2 cursor-pointer hover:text-amber-500 dark:hover:text-amber-400 transition-colors group/author"
                >
                  <img 
                    src={prompt.authorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${prompt.authorName || "Author"}`} 
                    alt={prompt.authorName} 
                    className="w-6 h-6 rounded-full object-cover border-2 border-white dark:border-neutral-800 shadow-sm group-hover/author:scale-110 transition-transform"
                  />
                  <span className="font-bold tracking-tight">@{prompt.authorName || 'Ẩn danh'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <img 
                    src={prompt.authorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${prompt.authorName || "Author"}`} 
                    alt={prompt.authorName} 
                    className="w-6 h-6 rounded-full object-cover border-2 border-white dark:border-neutral-800 shadow-sm"
                  />
                  <span className="font-bold tracking-tight text-neutral-700 dark:text-neutral-300">@{prompt.authorName || 'Ẩn danh'}</span>
                </div>
              )}
              <UserBadge subject={{ promptCount: 1 }} size="xs" />
            </div>
          </div>

          {/* Owner/Admin actions if applicable */}
          {isOwner && (
            <div className="flex items-center gap-1.5 shrink-0">
              {onPin && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPin(prompt); }}
                  title={isPinned ? "Bỏ ghim" : "Ghim lên đầu"}
                  className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                    isPinned 
                      ? 'bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20' 
                      : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Pin className="w-4 h-4" />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(prompt); }}
                  title="Chỉnh sửa Prompt"
                  className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(prompt.id); }}
                  title="Xoá Prompt"
                  className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Purpose */}
        {prompt.purpose && (
          <div className="flex gap-2 items-start">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed italic font-medium">
              {prompt.purpose}
            </p>
          </div>
        )}

        {/* Content Box */}
        <div className="relative group/code">
          <div className="p-5 bg-neutral-50 dark:bg-neutral-800/40 rounded-[1.5rem] border border-neutral-100 dark:border-neutral-800 font-mono text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin group-hover/code:border-neutral-200 dark:group-hover/code:border-neutral-700 transition-colors">
            {prompt.content}
          </div>
          <div className="absolute bottom-3 right-3 opacity-0 group-hover/code:opacity-100 transition-opacity">
             <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm px-2 py-1 rounded-lg text-[9px] font-black uppercase text-neutral-400">Preview</div>
          </div>
        </div>

        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {prompt.tags.map(t => (
              <span key={t} className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-[9px] font-black uppercase tracking-widest rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Interactive Actions: Quick Copy, Copy Counter, Save Button, Save Counter */}
      <div className="pt-5 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Counters */}
        <div className="flex items-center gap-5 text-[10px] font-black uppercase tracking-widest text-neutral-400">
          {/* Bộ đếm số lần sao chép */}
          <span className="flex items-center gap-2" title="Số lần sao chép">
            <Copy className="w-3.5 h-3.5 text-neutral-300" />
            <span><strong className="text-neutral-900 dark:text-neutral-100">{copyCount}</strong> Copies</span>
          </span>

          {/* Bộ đếm số lượt lưu */}
          <span className="flex items-center gap-2" title="Số lượt lưu">
            <Bookmark className="w-3.5 h-3.5 text-neutral-300" />
            <span><strong className="text-neutral-900 dark:text-neutral-100">{savesCount}</strong> Saves</span>
          </span>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleSave(); }}
            disabled={bookmarking}
            className={`p-3 rounded-xl border transition-all ${
              isBookmarked
                ? 'bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20'
                : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            title={isBookmarked ? "Bỏ lưu Prompt" : "Lưu Prompt vào bộ sưu tập"}
          >
            {isBookmarked ? (
              <BookmarkCheck className="w-4 h-4 fill-white" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
            className={`p-3 rounded-xl border transition-all ${
              showComments
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-black border-transparent shadow-lg'
                : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700'
            }`}
            title="Xem & Viết bình luận"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); handleQuickCopy(); }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-all rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-black/10 dark:shadow-white/10"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Quick Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Shared Comment System for Prompt */}
      {showComments && (
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800/80 animate-fade-in">
          <CommentSection
            targetId={prompt.id}
            targetType="PROMPT"
            targetTitle={prompt.name || prompt.title || 'Prompt'}
            targetOwnerId={prompt.authorId}
          />
        </div>
      )}

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType="PROMPT"
        targetId={prompt.id}
        targetName={prompt.name || prompt.title || 'Prompt'}
      />
    </div>
  );
}
