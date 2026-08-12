import React, { useState, useEffect } from 'react';
import { X, Upload, Send, CheckCircle2, Clock, Sparkles, Facebook, Instagram, Music, MessageSquare, Plus, Trash2, Globe } from 'lucide-react';
import { doc, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { evaluateUserBadges, BADGE_DEFINITIONS } from '../../lib/badges';
import toast from 'react-hot-toast';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export default function EditProfileModal({ isOpen, onClose, onSaveSuccess }: EditProfileModalProps) {
  const { user, setAuth, firebaseUser } = useAuthStore();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || '🎭 Sẵn sàng nhập vai');
  
  const [facebook, setFacebook] = useState(user?.socialLinks?.facebook || '');
  const [instagram, setInstagram] = useState(user?.socialLinks?.instagram || '');
  const [tiktok, setTiktok] = useState(user?.socialLinks?.tiktok || '');
  const [discord, setDiscord] = useState(user?.socialLinks?.discord || '');
  const [customLinks, setCustomLinks] = useState<{ label: string; url: string }[]>(user?.socialLinks?.customLinks || []);
  
  // Creator Request state
  const [requestStatus, setRequestStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED'>('IDLE');
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      setDisplayName(user.displayName || '');
      setAvatar(user.avatar || '');
      setBio(user.bio || '');
      setStatusMessage(user.statusMessage || '🎭 Sẵn sàng nhập vai');
      setFacebook(user.socialLinks?.facebook || '');
      setInstagram(user.socialLinks?.instagram || '');
      setTiktok(user.socialLinks?.tiktok || '');
      setDiscord(user.socialLinks?.discord || '');
      setCustomLinks(user.socialLinks?.customLinks || []);

      // Check existing creator request in Firestore
      const checkRequest = async () => {
        try {
          const reqRef = doc(db, 'creator_requests', user.id);
          const reqSnap = await getDoc(reqRef);
          if (reqSnap.exists()) {
            const data = reqSnap.data();
            setRequestStatus(data.status || 'IDLE');
            if (data.reason) setRequestReason(data.reason);
          } else if (user.creatorRequestStatus) {
            setRequestStatus(user.creatorRequestStatus);
          } else {
            setRequestStatus('IDLE');
          }
        } catch (e) {
          console.error("Error fetching creator request:", e);
        }
      };
      checkRequest();
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // Compute Current Badges
  const userBadges = evaluateUserBadges({
    creatorStatus: user.creatorStatus,
    role: user.role,
    createdAt: user.createdAt,
    badges: user.badges || [],
    characterCount: user.characterCount || 0,
    promptCount: user.promptCount || 0,
    totalLikes: user.totalLikes || 0,
    totalSaves: user.totalSaves || 0,
  });

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Dung lượng file vượt quá 10MB!");
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error("Chỉ chấp nhận định dạng JPG, JPEG, PNG, WEBP!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Str = event.target?.result as string;
      setAvatar(base64Str);
      toast.success("Tải ảnh đại diện thành công!");
    };
    reader.readAsDataURL(file);
  };

  const handleSendCreatorRequest = async () => {
    if (!user?.id) return;
    setSubmittingRequest(true);
    try {
      const reqData = {
        userId: user.id,
        userDisplayName: displayName.trim() || user.displayName,
        userAvatar: avatar || user.avatar || '',
        userEmail: user.email || '',
        userRole: user.role || 'USER',
        reason: requestReason.trim(),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'creator_requests', user.id), reqData);
      await updateDoc(doc(db, 'users', user.id), { creatorRequestStatus: 'PENDING' });

      setRequestStatus('PENDING');
      toast.success("Đã gửi yêu cầu trở thành Creator tới Quản trị viên (Admin)!");
    } catch (err: any) {
      console.error(err);
      toast.error("Gửi yêu cầu thất bại: " + (err.message || "Lỗi không xác định"));
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleAddCustomLink = () => {
    setCustomLinks([...customLinks, { label: '', url: '' }]);
  };

  const handleRemoveCustomLink = (index: number) => {
    setCustomLinks(customLinks.filter((_, idx) => idx !== index));
  };

  const handleCustomLinkChange = (index: number, field: 'label' | 'url', value: string) => {
    const updated = [...customLinks];
    updated[index][field] = value;
    setCustomLinks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Vui lòng nhập tên hiển thị.");
      return;
    }
    if (displayName.length > 50) {
      toast.error("Tên hiển thị tối đa 50 ký tự.");
      return;
    }
    if (bio.length > 600) {
      toast.error("Bio tối đa 600 ký tự.");
      return;
    }

    setSaving(true);
    try {
      const updatedData = {
        displayName: displayName.trim(),
        avatar,
        bio: bio.trim(),
        statusMessage: statusMessage.trim(),
        socialLinks: {
          facebook: facebook.trim(),
          instagram: instagram.trim(),
          tiktok: tiktok.trim(),
          discord: discord.trim(),
          customLinks: customLinks.filter(l => l.label.trim() && l.url.trim()),
        },
        updatedAt: new Date().toISOString()
      };

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, updatedData);

      // Update local state
      setAuth(firebaseUser, { ...user, ...updatedData });

      toast.success("Cập nhật hồ sơ thành công!");
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Không thể cập nhật hồ sơ: " + (err.message || "Lỗi không xác định"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-50 dark:bg-neutral-950 flex flex-col w-screen h-screen overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans animate-fade-in">
      {/* Fullscreen Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight uppercase">Chỉnh sửa hồ sơ</h2>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">Trải nghiệm biên soạn toàn màn hình</p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={onClose} 
          className="p-2.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 hover:text-black dark:hover:text-white"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fullscreen Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full space-y-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Basic Info */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-neutral-400 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              Thông tin cơ bản
            </h3>
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="relative group">
                  <img 
                    src={avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + displayName} 
                    alt="Avatar" 
                    className="w-28 h-28 rounded-full object-cover border-4 border-neutral-100 dark:border-neutral-800 shadow-xl group-hover:scale-102 transition-transform duration-300" 
                  />
                  <label htmlFor="avatar-upload" className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white text-xs font-bold rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload className="w-5 h-5 mb-1.5" />
                    Tải ảnh lên
                  </label>
                  <input 
                    id="avatar-upload" 
                    type="file" 
                    accept="image/jpeg,image/jpg,image/png,image/webp" 
                    onChange={handleAvatarUpload} 
                    className="hidden" 
                  />
                </div>
                <div className="text-center">
                  <div className="text-xs font-black text-neutral-400 uppercase tracking-widest">Ảnh tải lên</div>
                  <p className="text-[10px] text-neutral-400 mt-1 max-w-[150px]">Accepts JPG, PNG, WEBP (max 10MB)</p>
                </div>
              </div>

              {/* Tên & Bio inputs */}
              <div className="flex-1 w-full space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
                    Tên hiển thị <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)} 
                    maxLength={50}
                    placeholder="Nhập tên hiển thị" 
                    className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm transition-all"
                  />
                  <div className="text-right text-xs text-neutral-400 mt-1">{displayName.length}/50</div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-2">
                    Bio / Giới thiệu bản thân
                  </label>
                  <textarea 
                    rows={4}
                    value={bio} 
                    onChange={e => setBio(e.target.value)} 
                    maxLength={600}
                    placeholder="Viết một chút về bản thân bạn..." 
                    className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm resize-none transition-all"
                  />
                  <div className="text-right text-xs text-neutral-400 mt-1">{bio.length}/600</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Badges & Current Status */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-neutral-400 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              Huy hiệu & Trạng thái
            </h3>

            {/* Current Badge Display */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Huy hiệu hiện tại của bạn
              </label>
              {userBadges.length === 0 ? (
                <p className="text-xs text-neutral-400 italic bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                  Chưa có huy hiệu nào được kích hoạt. Hãy hoạt động tích cực để nhận huy hiệu danh giá!
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {userBadges.map((badgeId) => {
                    const def = BADGE_DEFINITIONS[badgeId];
                    if (!def) return null;
                    const Icon = def.icon;
                    return (
                      <div 
                        key={badgeId} 
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border ${def.borderClass} ${def.bgClass}`}
                      >
                        <div className={`p-2 rounded-xl bg-white dark:bg-neutral-950 border ${def.borderClass} shrink-0 shadow-sm`}>
                          <Icon className={`w-4 h-4 ${def.iconColorClass}`} />
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${def.colorClass}`}>{def.name}</div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                            {def.shortDescription}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Trạng thái hiện tại */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                Trạng thái hiện tại
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={['🎭 Sẵn sàng nhập vai', '✍️ Đang viết Prompt', '🔍 Đang tìm cốt truyện', '🟢 Đang hoạt động', '🔴 Bận rộn', '💤 Offline'].includes(statusMessage) ? statusMessage : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setStatusMessage(e.target.value);
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                >
                  <option value="🎭 Sẵn sàng nhập vai">🎭 Sẵn sàng nhập vai</option>
                  <option value="✍️ Đang viết Prompt">✍️ Đang viết Prompt</option>
                  <option value="🔍 Đang tìm cốt truyện">🔍 Đang tìm cốt truyện</option>
                  <option value="🟢 Đang hoạt động">🟢 Đang hoạt động</option>
                  <option value="🔴 Bận rộn">🔴 Bận rộn</option>
                  <option value="💤 Offline">💤 Offline</option>
                  <option value="custom">-- Nhập trạng thái tùy chỉnh --</option>
                </select>
                
                <input 
                  type="text" 
                  value={statusMessage} 
                  onChange={(e) => setStatusMessage(e.target.value)} 
                  placeholder="Nhập trạng thái tùy chỉnh khác..." 
                  maxLength={80}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Social & Custom Links */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-neutral-400 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              Liên kết liên hệ & Mạng xã hội
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Facebook className="w-3.5 h-3.5 text-blue-600" /> Facebook
                </label>
                <input 
                  type="text" 
                  value={facebook} 
                  onChange={e => setFacebook(e.target.value)} 
                  placeholder="https://facebook.com/username" 
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Instagram className="w-3.5 h-3.5 text-pink-500" /> Instagram
                </label>
                <input 
                  type="text" 
                  value={instagram} 
                  onChange={e => setInstagram(e.target.value)} 
                  placeholder="https://instagram.com/username" 
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Music className="w-3.5 h-3.5 text-neutral-800 dark:text-white" /> TikTok
                </label>
                <input 
                  type="text" 
                  value={tiktok} 
                  onChange={e => setTiktok(e.target.value)} 
                  placeholder="https://tiktok.com/@username" 
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Discord
                </label>
                <input 
                  type="text" 
                  value={discord} 
                  onChange={e => setDiscord(e.target.value)} 
                  placeholder="Username / Discord Link" 
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-xs"
                />
              </div>
            </div>

            {/* Custom Links Container */}
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-neutral-500" />
                    Các liên kết tùy chỉnh khác
                  </h4>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Thêm bất kỳ liên kết/trang web cá nhân nào khác của bạn</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold transition-all text-neutral-700 dark:text-neutral-300"
                >
                  <Plus className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Thêm link</span>
                </button>
              </div>

              <div className="space-y-2">
                {customLinks.map((link, idx) => (
                  <div key={idx} className="flex gap-2 items-center animate-fade-in">
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => handleCustomLinkChange(idx, 'label', e.target.value)}
                      placeholder="Tên liên kết (ví dụ: Portfolio, Blog...)"
                      required
                      className="w-1/3 px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    />
                    <input
                      type="text"
                      value={link.url}
                      onChange={(e) => handleCustomLinkChange(idx, 'url', e.target.value)}
                      placeholder="https://..."
                      required
                      className="flex-1 px-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomLink(idx)}
                      className="p-2.5 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all shrink-0"
                      title="Xóa liên kết"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {customLinks.length === 0 && (
                  <p className="text-xs text-neutral-400 italic bg-neutral-50/50 dark:bg-neutral-800/20 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800/80">
                    Chưa có liên kết tùy chỉnh bổ sung. Hãy nhấn "+ Thêm link" để bổ sung liên kết ngoài.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Creator Request Option if regular user */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm">Trạng thái yêu cầu Creator</h3>
            </div>

            {user.creatorStatus ? (
              <div className="flex items-center gap-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                <span>Bạn đã được phê duyệt làm Creator chính thức. Bạn có quyền đăng & quản lý Character!</span>
              </div>
            ) : requestStatus === 'PENDING' ? (
              <div className="flex items-center gap-3 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                <Clock className="w-5 h-5 shrink-0 text-amber-500 animate-spin" />
                <span>Yêu cầu quyền Creator của bạn đang chờ Quản trị viên (Admin) xét duyệt.</span>
              </div>
            ) : (
              <div className="space-y-3 bg-neutral-50 dark:bg-neutral-800/30 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <p className="text-xs text-neutral-500">
                  Để đăng tải được Character lên hệ thống Thế giới nhập vai_AD, bạn cần gửi yêu cầu phê duyệt cho Admin.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="Nhập lý do hoặc thông tin đóng góp (không bắt buộc)..."
                    className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  />
                  <button
                    type="button"
                    onClick={handleSendCreatorRequest}
                    disabled={submittingRequest}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingRequest ? "Đang gửi..." : "Gửi yêu cầu Creator"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800 shrink-0 pb-12">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 py-3 rounded-xl text-sm font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Hủy bỏ
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="px-8 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-extrabold hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50"
            >
              {saving ? "Đang lưu thay đổi..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

