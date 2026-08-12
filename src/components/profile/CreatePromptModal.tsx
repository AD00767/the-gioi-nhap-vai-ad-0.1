import React, { useState, useEffect, useRef } from 'react';
import { X, PenTool, Image as ImageIcon, Link as LinkIcon, Trash2, Plus, FileText, HelpCircle } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { PromptItem } from '../../types';
import toast from 'react-hot-toast';

interface CreatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  promptToEdit?: PromptItem | null;
}

export default function CreatePromptModal({ isOpen, onClose, onSuccess, promptToEdit }: CreatePromptModalProps) {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [link, setLink] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (promptToEdit) {
        setName(promptToEdit.title || promptToEdit.name || '');
        setPurpose(promptToEdit.purpose || '');
        setContent(promptToEdit.content || '');
        setNotes(promptToEdit.notes || '');
        setLink(promptToEdit.link || '');
        setImages(promptToEdit.images || []);
        setTags(promptToEdit.tags || []);
      } else {
        setName('');
        setPurpose('');
        setContent('');
        setNotes('');
        setLink('');
        setImages([]);
        setTags([]);
      }
    }
  }, [promptToEdit, isOpen]);

  if (!isOpen || !user) return null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.length > 30) {
      toast.error("Tên Tag không quá 30 ký tự.");
      return;
    }
    if (tags.length >= 6) {
      toast.error("Tối đa 6 Tag cho một Prompt.");
      return;
    }
    if (tags.includes(trimmed)) {
      toast.error("Tag đã tồn tại.");
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];

    if (images.length + files.length > 10) {
      toast.error("Tối đa 10 ảnh cho mỗi Prompt.");
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

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Vui lòng nhập tên Prompt.");
      return;
    }
    if (!purpose.trim()) {
      toast.error("Vui lòng nhập mục đích sử dụng Prompt.");
      return;
    }
    if (!content.trim()) {
      toast.error("Vui lòng nhập nội dung Prompt.");
      return;
    }

    setSaving(true);
    try {
      if (promptToEdit) {
        const promptRef = doc(db, 'prompts', promptToEdit.id);
        await updateDoc(promptRef, {
          name: name.trim(),
          purpose: purpose.trim(),
          content: content.trim(),
          notes: notes.trim(),
          link: link.trim(),
          images,
          tags,
          updatedAt: serverTimestamp()
        });
        toast.success("Cập nhật Prompt thành công!");
      } else {
        const { generateUniqueId } = await import('../../lib/generateId');
        const numericId = await generateUniqueId(db, 'prompt', '');
        
        await addDoc(collection(db, 'prompts'), {
          numericId,
          authorId: user.id,
          authorName: user.displayName,
          authorAvatar: user.avatar || '',
          name: name.trim(),
          purpose: purpose.trim(),
          content: content.trim(),
          notes: notes.trim(),
          link: link.trim(),
          images,
          tags,
          pinned: false,
          copyCount: 0,
          savesCount: 0,
          viewsCount: 0,
          createdAt: new Date().toISOString(),
          deletedAt: null
        });
        toast.success("Tạo Prompt mới thành công!");

        // Notify followers of new prompt
        try {
          const followersQuery = query(collection(db, 'follows'), where('targetCreatorId', '==', user.id));
          const followersSnap = await getDocs(followersQuery);
          for (const fDoc of followersSnap.docs) {
            const fData = fDoc.data();
            if (fData.followerId && fData.followerId !== user.id) {
              await addDoc(collection(db, 'notifications'), {
                userId: fData.followerId,
                type: 'NEW_CONTENT',
                title: 'Prompt mới từ Creator bạn follow',
                body: `${user.displayName} đã đăng một Prompt mới: ${name.trim()}`,
                read: false,
                createdAt: serverTimestamp()
              });
            }
          }
        } catch (notifErr) {
          console.error("Failed to notify followers about new prompt:", notifErr);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu Prompt: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-50 dark:bg-neutral-950 flex flex-col h-screen animate-fade-in overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-neutral-900 dark:text-neutral-100">
              {promptToEdit ? "Chỉnh sửa Prompt" : "Tạo Prompt Mới"}
            </h2>
            <p className="text-xs text-neutral-500">
              {promptToEdit ? "Cập nhật các thông tin chi tiết và lưu thay đổi" : "Chia sẻ prompt chất lượng cao đến cộng đồng"}
            </p>
          </div>
        </div>

        <button 
          onClick={onClose} 
          className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          title="Đóng giao diện"
        >
          <X className="w-6 h-6" />
        </button>
      </header>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-8 md:py-12 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Section 1: Thông tin cơ bản */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider pb-3 border-b border-neutral-100 dark:border-neutral-800">
              1. Thông tin cơ bản
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tên Prompt */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                  Tên Prompt <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="VD: Prompt tạo nhân vật phản diện thông minh" 
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>

              {/* Mục đích sử dụng */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                  Mục đích sử dụng <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={purpose} 
                  onChange={e => setPurpose(e.target.value)} 
                  placeholder="VD: Dùng viết RP, World Building, Thăng cấp hội thoại..." 
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Link bổ sung */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-neutral-400" />
                  Link tham khảo (Nếu có)
                </label>
                <input 
                  type="url" 
                  value={link} 
                  onChange={e => setLink(e.target.value)} 
                  placeholder="https://example.com/tai-nguyen" 
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>

              {/* Tag System */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide">
                  Thẻ phân loại (Tags - Tối đa 6 Tag)
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={tagInput} 
                    onChange={e => setTagInput(e.target.value)} 
                    placeholder="Nhập tag rồi ấn thêm..." 
                    className="flex-1 px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none text-sm"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  />
                  <button 
                    type="button" 
                    onClick={handleAddTag} 
                    className="px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-xs font-extrabold hover:opacity-95 transition-opacity"
                  >
                    Thêm
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      #{tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors ml-1 p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  {tags.length === 0 && (
                    <span className="text-xs text-neutral-400 italic">Chưa thêm tag nào.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Tài liệu & Hình ảnh minh họa */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider pb-3 border-b border-neutral-100 dark:border-neutral-800">
              2. Hình ảnh minh họa & Giao diện sử dụng
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Tải Ảnh Lên (Cho phép tải lên nhiều ảnh)
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Chọn các hình ảnh chụp màn hình kết quả hoặc thiết lập của Prompt. Định dạng hỗ trợ: JPG, JPEG, PNG, WEBP. Tối đa 10MB/ảnh.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Chọn ảnh</span>
                </button>
              </div>

              <input 
                type="file" 
                ref={fileInputRef}
                multiple 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="hidden" 
              />

              {/* Grid Images View */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 pt-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative aspect-video rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden group bg-neutral-100 dark:bg-neutral-900">
                    <img 
                      src={img} 
                      alt={`Prompt Capture ${idx + 1}`} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="p-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
                        title="Xóa hình ảnh này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {images.length === 0 && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="col-span-full border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <ImageIcon className="w-8 h-8 text-neutral-400" />
                    <span className="text-xs text-neutral-500 font-medium">Chưa tải ảnh minh họa nào lên. Nhấn để chọn ảnh.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Nội dung & Hướng dẫn */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider pb-3 border-b border-neutral-100 dark:border-neutral-800">
              3. Nội dung cấu trúc Prompt & Ghi chú
            </h3>

            {/* Nội dung Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide flex items-center justify-between">
                <span>Nội dung Prompt <span className="text-red-500">*</span></span>
                <span className="text-[10px] text-neutral-400 lowercase font-normal">Hỗ trợ các khối lệnh, hệ thống chỉ thị</span>
              </label>
              <textarea 
                rows={10}
                value={content} 
                onChange={e => setContent(e.target.value)} 
                placeholder="Nhập chi tiết mã prompt hoặc System Instructions cho Google AI Studio tại đây..." 
                className="w-full p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-xs md:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed"
              />
            </div>

            {/* Ghi chú */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                Ghi chú thêm (Nếu có)
              </label>
              <textarea 
                rows={4}
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="VD: Cần sử dụng model Gemini 1.5 Pro, điều chỉnh Temperature về 0.7 để có kết quả tốt nhất..." 
                className="w-full p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
              />
            </div>
          </div>

        </div>
      </form>

      {/* Sticky Bottom Actions */}
      <footer className="sticky bottom-0 z-10 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="text-xs text-neutral-400 font-medium hidden md:block">
          Hãy đảm bảo nội dung tuân thủ đúng quy chế cộng đồng.
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-6 py-3 rounded-2xl text-sm font-extrabold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Hủy bỏ
          </button>
          <button 
            type="submit" 
            disabled={saving} 
            onClick={handleSubmit}
            className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-extrabold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-md"
          >
            {saving ? "Đang xử lý..." : (promptToEdit ? "Lưu thay đổi" : "Đăng Prompt")}
          </button>
        </div>
      </footer>
    </div>
  );
}
