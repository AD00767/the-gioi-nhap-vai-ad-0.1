import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, UserPlus, Users, BookOpen, PenTool, Flag, Loader2, Music } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { CreatorItem } from '../types';
import ReportModal from './ReportModal';
import UserBadge from './UserBadge';
import DisplayId from './DisplayId';
import toast from 'react-hot-toast';
import { checkIsFollowing, toggleFollow } from '../lib/followService';
import { getExactCreatorStats } from '../lib/statsService';

interface CreatorCardProps {
  key?: React.Key;
  creator: CreatorItem;
  onUpdate?: () => void;
}

export default function CreatorCard({ creator, onUpdate }: CreatorCardProps) {
  const { user } = useAuthStore();
  const [isFollowing, setIsFollowing] = useState(false);
  const [characterCount, setCharacterCount] = useState(creator.characterCount || 0);
  const [promptCount, setPromptCount] = useState(creator.promptCount || 0);
  const [followerCount, setFollowerCount] = useState(creator.followerCount || 0);
  const [loading, setLoading] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Sync initial props
  useEffect(() => {
    setCharacterCount(creator.characterCount || 0);
    setPromptCount(creator.promptCount || 0);
    setFollowerCount(creator.followerCount || 0);
  }, [creator.characterCount, creator.promptCount, creator.followerCount]);

  // Load exact real-time stats from database to ensure 100% accuracy
  useEffect(() => {
    if (!creator?.id) return;
    let isMounted = true;

    getExactCreatorStats(creator.id).then(stats => {
      if (isMounted) {
        setCharacterCount(stats.characterCount);
        setPromptCount(stats.promptCount);
        setFollowerCount(stats.followerCount);
      }
    }).catch(err => {
      console.log("Notice: Using fallback creator stats:", err);
    });

    return () => { isMounted = false; };
  }, [creator?.id]);

  // Check follow status for current logged in user
  useEffect(() => {
    if (!user?.id || !creator.id) return;
    if (user.id === creator.id) return;

    const checkFollow = async () => {
      try {
        const hasFollow = await checkIsFollowing(user.id, creator.id);
        setIsFollowing(hasFollow);
      } catch (e) {
        console.error("Check follow error:", e);
      }
    };
    checkFollow();
  }, [user?.id, creator.id]);

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Vui lòng đăng nhập để theo dõi Creator này!");
      return;
    }
    if (user.id === creator.id) {
      toast.error("Bạn không thể tự theo dõi chính mình!");
      return;
    }

    setLoading(true);
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
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error("Toggle follow error:", e);
      toast.error("Thao tác thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const isSelf = user?.id === creator.id;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 p-7 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 flex flex-col justify-between group h-full relative overflow-hidden">
      <div>
        {/* Header with Avatar, Badges, Name, and ID */}
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div>
            <Link to={`/creator/${creator.id}`} className="relative group/avatar">
              <img 
                src={creator.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.displayName}`} 
                alt={creator.displayName}
                className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-neutral-800 shadow-xl group-hover/avatar:scale-105 transition-transform duration-500"
              />
            </Link>
          </div>
          
          <div className="min-w-0 flex flex-col items-center gap-1.5 w-full">
            <Link to={`/creator/${creator.id}`} className="hover:text-amber-500 transition-colors w-full text-center">
              <h3 className="text-lg font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tight truncate max-w-full mx-auto">
                {creator.displayName}
              </h3>
            </Link>

            {/* Badges */}
            <div className="flex items-center justify-center gap-1 my-0.5">
              <UserBadge 
                subject={{ 
                  ...creator, 
                  creatorStatus: true,
                  characterCount,
                  promptCount,
                  followerCount
                }} 
                size="xs" 
                maxVisible={3}
              />
            </div>

            {/* Display ID */}
            <div className="flex items-center justify-center gap-2">
              <DisplayId 
                type="creator" 
                numericId={creator.numericId} 
                fallbackId={creator.id} 
                className="bg-neutral-100 dark:bg-neutral-800 border-none text-neutral-400 text-[9px] font-black" 
              />
            </div>

            {creator.statusMessage && (
              <div className="mt-1 flex justify-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 dark:border-emerald-500/5 rounded-full text-[10px] font-medium leading-none">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate max-w-[130px]">{creator.statusMessage}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-6 text-center leading-relaxed font-medium italic opacity-85 h-9">
          {creator.bio || "Chưa có lời giới thiệu."}
        </p>

        {/* Social Links if available */}
        {creator.socialLinks && (
          (creator.socialLinks.facebook || creator.socialLinks.instagram || creator.socialLinks.tiktok || creator.socialLinks.discord) ? (
            <div className="flex items-center justify-center gap-2.5 mb-6">
              {creator.socialLinks.facebook && (
                <a href={creator.socialLinks.facebook.startsWith('http') ? creator.socialLinks.facebook : `https://${creator.socialLinks.facebook}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-blue-500 transition-all border border-neutral-100 dark:border-neutral-700">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {creator.socialLinks.instagram && (
                <a href={creator.socialLinks.instagram.startsWith('http') ? creator.socialLinks.instagram : `https://${creator.socialLinks.instagram}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-pink-500 transition-all border border-neutral-100 dark:border-neutral-700">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204 013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              )}
              {creator.socialLinks.tiktok && (
                <a href={creator.socialLinks.tiktok.startsWith('http') ? creator.socialLinks.tiktok : `https://${creator.socialLinks.tiktok}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all border border-neutral-100 dark:border-neutral-700">
                  <Music className="w-3.5 h-3.5" />
                </a>
              )}
              {creator.socialLinks.discord && (
                <a href={creator.socialLinks.discord.startsWith('http') ? creator.socialLinks.discord : `https://${creator.socialLinks.discord}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-500 transition-all border border-neutral-100 dark:border-neutral-700">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                </a>
              )}
            </div>
          ) : null
        )}

        {/* Precise Statistics Bar: Total Character / Prompt / Followers */}
        <div className="w-full grid grid-cols-3 divide-x divide-neutral-200/80 dark:divide-neutral-800/80 bg-neutral-50 dark:bg-neutral-800/50 py-3 px-1.5 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/80 text-center mb-6 shadow-sm">
          <div className="min-w-0 flex flex-col items-center justify-center px-1 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 w-full overflow-hidden leading-none">
              <BookOpen className="w-3 h-3 text-amber-500 flex-shrink-0" />
              <span className="truncate">Character</span>
            </div>
            <div className="text-sm sm:text-base font-black text-neutral-900 dark:text-neutral-100 leading-none truncate w-full tracking-tight">
              {characterCount.toLocaleString()}
            </div>
          </div>

          <div className="min-w-0 flex flex-col items-center justify-center px-1 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 w-full overflow-hidden leading-none">
              <PenTool className="w-3 h-3 text-blue-500 flex-shrink-0" />
              <span className="truncate">Prompt</span>
            </div>
            <div className="text-sm sm:text-base font-black text-neutral-900 dark:text-neutral-100 leading-none truncate w-full tracking-tight">
              {promptCount.toLocaleString()}
            </div>
          </div>

          <div className="min-w-0 flex flex-col items-center justify-center px-1 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5 w-full overflow-hidden leading-none">
              <Users className="w-3 h-3 text-emerald-500 flex-shrink-0" />
              <span className="truncate">Followers</span>
            </div>
            <div className="text-sm sm:text-base font-black text-neutral-900 dark:text-neutral-100 leading-none truncate w-full tracking-tight">
              {followerCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons: Follow & View Profile */}
      <div className="flex flex-col gap-2.5 w-full">
        {!isSelf && (
          <button
            onClick={handleToggleFollow}
            disabled={loading}
            className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 shadow-lg ${
              isFollowing
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90 shadow-black/10 dark:shadow-white/10'
            }`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isFollowing ? (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Đang theo dõi</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                <span>Theo dõi Creator</span>
              </>
            )}
          </button>
        )}
        
        <Link
          to={`/creator/${creator.id}`}
          className="w-full py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 font-black uppercase tracking-widest text-[9px] text-center flex items-center justify-center gap-2 transition-all border border-neutral-100 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          <span>Xem Trang Cá Nhân</span>
        </Link>
      </div>

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

