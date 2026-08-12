import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Lock, Globe, UserCheck, Send, AlertCircle, Search, 
  Upload, Trash2, Image as ImageIcon, Check, Info, HelpCircle
} from 'lucide-react';
import { collection, getDocs, addDoc, serverTimestamp, query, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface UserOption {
  id: string;
  displayName: string;
  avatar: string;
  email?: string;
  creatorStatus?: boolean;
}

interface CreateFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultRecipientId?: string;
}

export default function CreateFeedbackModal({
  isOpen,
  onClose,
  onSuccess,
  defaultRecipientId
}: CreateFeedbackModalProps) {
  const { user, firebaseUser } = useAuthStore();

  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<UserOption | null>(null);

  const [mode, setMode] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch available users for recipient selection
  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(200)));
        const list: UserOption[] = [];
        snap.docs.forEach(docSnap => {
          const uData = docSnap.data();
          if (docSnap.id !== user?.id && !uData.deletedAt) {
            list.push({
              id: docSnap.id,
              displayName: uData.displayName || 'Thành viên',
              avatar: uData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${docSnap.id}`,
              email: uData.email,
              creatorStatus: uData.creatorStatus
            });
          }
        });
        setUsersList(list);

        if (defaultRecipientId) {
          const match = list.find(u => u.id === defaultRecipientId);
          if (match) setSelectedRecipient(match);
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách người dùng:", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen, user?.id, defaultRecipientId]);

  if (!isOpen) return null;

  const filteredUsers = usersList.filter(u =>
    u.displayName.toLowerCase().includes(recipientSearch.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(recipientSearch.toLowerCase()))
  );

  // File drop & select handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (filesList: FileList) => {
    const files = Array.from(filesList);

    if (images.length + files.length > 10) {
      toast.error("Tối đa 10 ảnh cho mỗi Feedback.");
      return;
    }

    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        toast.error(`Định dạng tệp ${file.name} không hợp lệ. Chỉ chấp nhận JPG, JPEG, PNG, WEBP.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Kích thước tệp ${file.name} vượt quá 10MB.`);
        return;
      }
    }

    const promises = files.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(base64s => {
      setImages(prev => [...prev, ...base64s]);
      toast.success(`Đã thêm ${files.length} ảnh thành công!`);
    }).catch(err => {
      console.error(err);
      toast.error("Lỗi khi đọc file ảnh.");
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Vui lòng đăng nhập để gửi Feedback!");
      return;
    }

    if (!selectedRecipient) {
      toast.error("Vui lòng chọn người nhận Feedback!");
      return;
    }

    if (!content.trim()) {
      toast.error("Vui lòng nhập nội dung Feedback!");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create feedback document
      const currentSenderId = user.id || firebaseUser?.uid;
      const feedbackData = {
        senderId: currentSenderId,
        senderName: user.displayName,
        senderAvatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        recipientId: selectedRecipient.id,
        recipientName: selectedRecipient.displayName,
        recipientAvatar: selectedRecipient.avatar,
        mode: mode,
        title: title.trim(),
        content: content.trim(),
        images: images, // Saved Base64 Images Array
        reactions: {},
        reactionsCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null
      };

      const fbRef = await addDoc(collection(db, 'feedbacks'), feedbackData);

      // 2. Create notification for recipient
      await addDoc(collection(db, 'notifications'), {
        userId: selectedRecipient.id,
        recipientId: selectedRecipient.id,
        senderId: user.id,
        senderName: user.displayName,
        senderAvatar: user.avatar || '',
        type: 'FEEDBACK',
        targetId: fbRef.id,
        targetType: 'FEEDBACK',
        title: mode === 'PUBLIC' ? 'Có Feedback công khai mới' : 'Có Feedback riêng tư mới',
        message: `${user.displayName} vừa gửi cho bạn một Feedback ${mode === 'PUBLIC' ? 'công khai' : 'riêng tư'}.`,
        link: '/feedbacks',
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success(`Đã gửi Feedback ${mode === 'PUBLIC' ? 'công khai' : 'riêng tư'} thành công!`);
      
      // Reset form
      setContent('');
      setTitle('');
      setImages([]);
      setSelectedRecipient(null);
      setRecipientSearch('');

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Gửi Feedback thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-50 dark:bg-neutral-950 flex flex-col w-screen h-screen overflow-hidden animate-fade-in text-neutral-900 dark:text-neutral-100 font-sans">
      {/* FULL SCREEN HEADER */}
      <header className="sticky top-0 z-10 shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
              Tạo Feedback Mới
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:block">
              Nơi gửi nhận xét công khai tới cộng đồng hoặc gửi thư bảo mật riêng tư.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-3 rounded-2xl text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer flex items-center gap-1.5 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 font-bold text-xs"
        >
          <span>Đóng (Esc)</span>
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* FULL SCREEN SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950/40">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto w-full px-6 py-10 space-y-8">
          
          {/* SENDER FIELD (Người Gửi - Tự động mặc định) */}
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400">
                1. Người Gửi
              </h3>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/50 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
                  alt="Sender Avatar"
                  className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-neutral-800 shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="font-extrabold text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <span>{user?.displayName}</span>
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      Mặc định tự động
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Hệ thống tự động liên kết tài khoản của bạn để bảo đảm minh bạch.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* RECIPIENT FIELD (Người Nhận) */}
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400">
                2. Người Nhận Feedback <span className="text-red-500">*</span>
              </h3>
            </div>

            {selectedRecipient ? (
              <div className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl transition-all">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedRecipient.avatar}
                    alt={selectedRecipient.displayName}
                    className="w-12 h-12 rounded-full border-2 border-indigo-500/20 object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="font-black text-base text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                      <span>{selectedRecipient.displayName}</span>
                      {selectedRecipient.creatorStatus && (
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase">
                          Creator
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Feedback này sẽ được gửi trực tiếp vào bảng thư của người dùng này.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/10 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-all cursor-pointer"
                >
                  Thay đổi người nhận
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Nhập tên hoặc email của thành viên, Creator cần gửi..."
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto border border-neutral-200 dark:border-neutral-800 rounded-2xl divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                  {loadingUsers ? (
                    <div className="p-6 text-center text-sm text-neutral-400 flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-neutral-300 border-t-indigo-500 rounded-full animate-spin"></span>
                      <span>Đang tải người dùng...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-sm text-neutral-400">
                      Không tìm thấy người dùng phù hợp với từ khóa của bạn.
                    </div>
                  ) : (
                    filteredUsers.map(u => (
                      <button
                        type="button"
                        key={u.id}
                        onClick={() => setSelectedRecipient(u)}
                        className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={u.avatar} 
                            alt={u.displayName} 
                            className="w-9 h-9 rounded-full object-cover border shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {u.displayName}
                            </span>
                            {u.creatorStatus && (
                              <span className="ml-2 px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-[9px] font-black uppercase tracking-wider">
                                Creator
                              </span>
                            )}
                            <p className="text-[10px] text-neutral-400 mt-0.5">{u.email}</p>
                          </div>
                        </div>
                        <span className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-all">
                          Chọn người này
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>

          {/* CHẾ ĐỘ FEEDBACK (Công Khai vs Riêng Tư) */}
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400">
                3. Chế Độ Feedback <span className="text-red-500">*</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Public Feedback Card */}
              <button
                type="button"
                onClick={() => setMode('PUBLIC')}
                className={`p-5 rounded-2xl border text-left flex flex-col gap-2.5 transition-all relative overflow-hidden group cursor-pointer ${
                  mode === 'PUBLIC'
                    ? 'bg-blue-500/5 border-blue-500/60 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200/80 dark:border-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm">
                    <div className="p-2 rounded-xl bg-blue-500/10">
                      <Globe className="w-4 h-4 text-blue-500" />
                    </div>
                    <span>Feedback Công Khai</span>
                  </div>
                  {mode === 'PUBLIC' && (
                    <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm animate-scale-in">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-90 leading-relaxed font-medium">
                  Hiển thị công khai trên Bảng tin của cộng đồng. Mọi thành viên đều có thể xem, bình luận đa cấp, và bày tỏ cảm xúc.
                </p>
                <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
                  <Globe className="w-24 h-24" />
                </div>
              </button>

              {/* Private Feedback Card */}
              <button
                type="button"
                onClick={() => setMode('PRIVATE')}
                className={`p-5 rounded-2xl border text-left flex flex-col gap-2.5 transition-all relative overflow-hidden group cursor-pointer ${
                  mode === 'PRIVATE'
                    ? 'bg-amber-500/5 border-amber-500/60 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20 shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200/80 dark:border-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-sm">
                    <div className="p-2 rounded-xl bg-amber-500/10">
                      <Lock className="w-4 h-4 text-amber-500" />
                    </div>
                    <span>Feedback Riêng Tư</span>
                  </div>
                  {mode === 'PRIVATE' && (
                    <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm animate-scale-in">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-90 leading-relaxed font-medium">
                  Gửi kín đáo dưới dạng thư bảo mật. Chỉ duy nhất người gửi (bạn) và người nhận có thể đọc, thả cảm xúc, và gửi phản hồi qua lại.
                </p>
                <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
                  <Lock className="w-24 h-24" />
                </div>
              </button>
            </div>
          </section>

          {/* TIÊU ĐỀ & NỘI DUNG FEEDBACK */}
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500"></span>
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400">
                4. Thông Tin Chi Tiết
              </h3>
            </div>

            {/* Title (Tiêu Đề) */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Tiêu đề Feedback <span className="text-neutral-400 font-normal normal-case">(Tùy chọn)</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Góp ý thiết kế nhân vật / Ý kiến về Prompt..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-4 py-3 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-black dark:focus:border-white transition-all"
              />
            </div>

            {/* Content (Nội Dung) */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Nội dung chi tiết <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={6}
                placeholder={
                  mode === 'PUBLIC'
                    ? 'Nhập các nhận xét, góp ý hoặc cảm ơn đóng góp mang tính xây dựng của bạn tới cộng đồng...'
                    : 'Nhập nội dung thư riêng tư bí mật gửi trực tiếp đến hộp thư của người này...'
                }
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full p-4 text-sm rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-black dark:focus:border-white transition-all leading-relaxed resize-none"
              />
            </div>
          </section>

          {/* THÊM ẢNH (Cho phép tải lên nhiều ảnh) */}
          <section className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <h3 className="text-sm font-black uppercase tracking-wider text-neutral-400">
                  5. Ảnh Minh Họa / Đính Kèm ({images.length}/10)
                </h3>
              </div>
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                Tải tối đa 10 ảnh
              </span>
            </div>

            {/* DRAG AND DROP AREA */}
            <div
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all text-center cursor-pointer ${
                dragActive
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/jpg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  Kéo và thả tệp ảnh vào đây, hoặc <span className="text-indigo-600 dark:text-indigo-400 hover:underline">nhấp để duyệt tệp</span>
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Hỗ trợ định dạng JPG, JPEG, PNG, WEBP. Kích thước tối đa 10MB mỗi ảnh.
                </p>
              </div>
            </div>

            {/* PREVIEW IMAGE GALLERY */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 pt-2">
                {images.map((base64, index) => (
                  <div
                    key={index}
                    className="group relative aspect-square rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-100 dark:bg-neutral-900 shadow-sm"
                  >
                    <img
                      src={base64}
                      alt={`Upload preview ${index + 1}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(index);
                        }}
                        className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg transition-colors cursor-pointer"
                        title="Xóa ảnh này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ATTENTION INFO NOTIFICATION */}
          <div className="p-4 bg-neutral-100 dark:bg-neutral-900 rounded-2xl text-xs text-neutral-500 dark:text-neutral-400 flex items-start gap-3 border border-neutral-200/50 dark:border-neutral-800">
            <AlertCircle className="w-5 h-5 shrink-0 text-indigo-500 mt-0.5" />
            <p className="leading-relaxed">
              {mode === 'PUBLIC'
                ? 'Lưu ý: Feedback công khai sẽ xuất hiện trên dòng sự kiện công cộng. Hãy giữ cho nhận xét của bạn mang tính tích cực, khách quan, và tôn trọng người khác.'
                : 'Lưu ý: Feedback riêng tư là nội dung được gửi trực tiếp, bảo mật và tôn trọng quyền riêng tư. Không một ai khác kể cả quản trị viên có thể đọc nội dung này ngoại trừ hai bạn.'}
            </p>
          </div>

          {/* FOOTER FORM ACTIONS */}
          <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-xs font-extrabold hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              Hủy bỏ & Đóng
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedRecipient || !content.trim()}
              className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black text-xs hover:opacity-90 transition-all shadow-md disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin"></span>
                  <span>Đang gửi Feedback...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Gửi Feedback Ngay</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
