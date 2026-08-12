import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  X, Upload, Link as LinkIcon, Sparkles, Plus, Trash2, ArrowLeft, 
  CheckCircle2, AlertCircle, Image as ImageIcon, Tag as TagIcon, FileText, MessageSquare, Quote, Info
} from 'lucide-react';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';

export default function CreateCharacter() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, firebaseUser, setAuth } = useAuthStore();
  
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [gender, setGender] = useState('Nữ');
  const [slogan, setSlogan] = useState('');
  const [plot, setPlot] = useState('');
  const [openingScene, setOpeningScene] = useState('');
  const [notes, setNotes] = useState('');
  
  // Link states: 'HAS_LINK' | 'NO_LINK'
  const [hasLink, setHasLink] = useState(true);
  const [links, setLinks] = useState<string[]>(['']);
  
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      toast.error("Vui lòng đăng nhập để tiếp tục.");
      navigate('/home');
      return;
    }

    if (id) {
      const fetchCharacter = async () => {
        try {
          const docRef = doc(db, 'characters', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Permission check: owner or admin
            if (data.creatorId !== user.id && user.role !== 'ADMIN') {
              toast.error("Bạn không có quyền chỉnh sửa Character này.");
              navigate('/profile');
              return;
            }
            setName(data.name || '');
            setAvatar(data.avatar || '');
            setGender(data.gender || 'Nữ');
            setSlogan(data.slogan || '');
            setPlot(data.plot || '');
            setOpeningScene(data.openingScene || '');
            setNotes(data.notes || '');
            setTags(data.tags || []);
            
            if (data.links && data.links.length > 0) {
              setHasLink(true);
              setLinks(data.links);
            } else if (data.characterLink || data.link) {
              setHasLink(true);
              setLinks([data.characterLink || data.link]);
            } else {
              setHasLink(false);
              setLinks(['']);
            }
          } else {
            toast.error("Không tìm thấy Character.");
            navigate('/profile');
          }
        } catch (error) {
          console.error("Error loading character:", error);
          toast.error("Lỗi khi tải thông tin Character.");
        } finally {
          setLoading(false);
        }
      };
      fetchCharacter();
    }
  }, [id, user, navigate]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 font-medium text-sm">Đang tải dữ liệu Character...</p>
        </div>
      </div>
    );
  }

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
      setAvatar(event.target?.result as string);
      toast.success("Tải ảnh nhân vật thành công!");
    };
    reader.readAsDataURL(file);
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (!newTag) return;
    if (newTag.length > 30) {
      toast.error("Tag tối đa 30 ký tự.");
      return;
    }
    if (tags.length >= 12) {
      toast.error("Số tag tối đa là 12 tag.");
      return;
    }
    if (tags.includes(newTag)) {
      toast.error("Tag này đã được thêm.");
      return;
    }
    setTags([...tags, newTag]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleLinkChange = (index: number, value: string) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const addLinkField = () => {
    setLinks([...links, '']);
  };

  const removeLinkField = (index: number) => {
    if (links.length > 1) {
      const newLinks = [...links];
      newLinks.splice(index, 1);
      setLinks(newLinks);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!name.trim()) {
      toast.error("Vui lòng nhập Tên Character.");
      return;
    }
    if (name.trim().length > 50) {
      toast.error("Tên Character không được vượt quá 50 ký tự.");
      return;
    }
    if (!avatar) {
      toast.error("Vui lòng tải ảnh đại diện cho Character.");
      return;
    }
    if (!slogan.trim()) {
      toast.error("Vui lòng nhập Câu Slogan.");
      return;
    }
    if (slogan.trim().length > 700) {
      toast.error("Slogan không được vượt quá 700 ký tự.");
      return;
    }
    if (!plot.trim()) {
      toast.error("Vui lòng nhập Cốt truyện (Plot).");
      return;
    }

    let finalLinks: string[] = [];
    if (hasLink) {
      finalLinks = links.map(l => l.trim()).filter(l => l.length > 0);
      if (finalLinks.length === 0) {
        toast.error("Bạn đã chọn 'Đã Có Link'. Vui lòng nhập ít nhất 1 link Character.");
        return;
      }
      for (const link of finalLinks) {
        if (!link.startsWith("http://") && !link.startsWith("https://")) {
          toast.error("Đường dẫn phải bắt đầu bằng http:// hoặc https://");
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (id) {
        const charRef = doc(db, 'characters', id);
        await updateDoc(charRef, {
          name: name.trim(),
          avatar,
          gender,
          slogan: slogan.trim(),
          plot: plot.trim(),
          openingScene: openingScene.trim(),
          notes: notes.trim(),
          tags,
          links: finalLinks,
          characterLink: finalLinks.length > 0 ? finalLinks[0] : "",
          updatedAt: serverTimestamp()
        });
        toast.success("Cập nhật Character thành công!");
      } else {
        const { generateUniqueId } = await import('../lib/generateId');
        const numericId = await generateUniqueId(db, 'character', '');

        await addDoc(collection(db, 'characters'), {
          numericId,
          name: name.trim(),
          avatar,
          gender,
          slogan: slogan.trim(),
          plot: plot.trim(),
          openingScene: openingScene.trim(),
          notes: notes.trim(),
          tags,
          links: finalLinks,
          characterLink: finalLinks.length > 0 ? finalLinks[0] : "",
          creatorId: user.id,
          creatorName: user.displayName || 'Creator',
          creatorAvatar: user.avatar || user.photoURL || '',
          likesCount: 0,
          savesCount: 0,
          viewsCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deletedAt: null
        });

        // Ensure user creatorStatus is activated in Firestore & Local State
        try {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, { creatorStatus: true, updatedAt: serverTimestamp() }).catch(async () => {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(userRef, { creatorStatus: true }, { merge: true });
          });
          setAuth(firebaseUser, { ...user, creatorStatus: true });
          localStorage.setItem('cached_creator_status', 'true');
        } catch (uErr) {
          console.log("Notice: Failed to update user creatorStatus:", uErr);
        }

        // Send notifications to followers
        try {
          const q = query(collection(db, 'follows'), where('followingId', '==', user.id));
          const followDocs = await getDocs(q);
          for (const fdoc of followDocs.docs) {
            const followerId = fdoc.data().followerId;
            await addDoc(collection(db, 'notifications'), {
              userId: followerId,
              type: 'NEW_CHARACTER',
              title: 'Character Mới',
              body: `${user.displayName} vừa đăng Character mới: ${name.trim()}`,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        } catch (notifErr) {
          console.error("Lỗi khi gửi thông báo cho follower:", notifErr);
        }

        toast.success("Tạo Character mới thành công!");
      }

      // Navigate back to profile or creator dashboard
      navigate('/profile');
    } catch (err: any) {
      console.error("Save character error:", err);
      toast.error("Lỗi khi lưu Character: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col overflow-y-auto">
      {/* Top Fixed Header */}
      <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            type="button" 
            onClick={() => navigate(-1)} 
            className="p-2.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              <span>{id ? "Chỉnh sửa Character" : "Tạo Character Mới"}</span>
            </h1>
            <p className="text-xs text-neutral-400 hidden sm:block">
              {id ? "Cập nhật các thông tin nhân vật Roleplay của bạn" : "Tạo nhân vật Roleplay cho cộng đồng Google AI Studio"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-white text-black font-black uppercase text-xs tracking-wider hover:bg-neutral-200 transition-all disabled:opacity-50 shadow-lg flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>{id ? "Lưu thay đổi" : "Đăng Character"}</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 md:p-12 space-y-8 pb-32">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Section 1: Avatar Upload */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-widest">
              <ImageIcon className="w-4 h-4" />
              <span>1. Ảnh đại diện Character</span>
              <span className="text-red-500">*</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-2">
              <div className="relative group shrink-0">
                {avatar ? (
                  <img 
                    src={avatar} 
                    alt="Character Avatar" 
                    className="w-36 h-36 rounded-2xl object-cover border-2 border-neutral-700 shadow-xl"
                  />
                ) : (
                  <div className="w-36 h-36 rounded-2xl bg-neutral-800 border-2 border-dashed border-neutral-700 flex flex-col items-center justify-center text-neutral-500 gap-2">
                    <ImageIcon className="w-8 h-8 stroke-1" />
                    <span className="text-xs">Chưa có ảnh</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-4 text-center sm:text-left">
                <div>
                  <label className="inline-flex items-center gap-2 px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm rounded-xl cursor-pointer transition-colors shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>{avatar ? "Thay đổi ảnh tải lên" : "Tải ảnh từ máy lên"}</span>
                    <input 
                      type="file" 
                      accept="image/jpeg,image/jpg,image/png,image/webp" 
                      onChange={handleAvatarUpload} 
                      className="hidden" 
                    />
                  </label>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                    Định dạng JPG, JPEG, PNG, WEBP. Dung lượng tối đa 10MB.
                  </p>
                </div>

                <div className="pt-2 border-t border-neutral-800">
                  <span className="text-xs text-neutral-400 block mb-2 font-medium">Hoặc dán URL ảnh trực tiếp:</span>
                  <input
                    type="url"
                    value={avatar.startsWith("data:") ? "" : avatar}
                    onChange={e => setAvatar(e.target.value)}
                    placeholder="https://example.com/character-avatar.jpg"
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Basic Info (Name & Gender) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-widest">
              <FileText className="w-4 h-4" />
              <span>2. Thông tin cơ bản</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="sm:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-neutral-300">
                  Tên Character <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input 
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={50}
                    placeholder="Nhập tên nhân vật (Ví dụ: Emi, Cửu Vĩ, Lyra...)"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors pr-16"
                  />
                  <span className="absolute right-3 top-3 text-xs text-neutral-500 font-mono">
                    {name.length}/50
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-neutral-300">
                  Giới tính <span className="text-red-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="Nữ">Nữ</option>
                  <option value="Nam">Nam</option>
                  <option value="Phi giới tính">Phi giới tính / Khác</option>
                </select>
              </div>
            </div>

            {/* Slogan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-neutral-300">
                  Câu Slogan <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-neutral-500 font-mono">
                  {slogan.length}/700
                </span>
              </div>
              <textarea
                rows={3}
                value={slogan}
                onChange={e => setSlogan(e.target.value)}
                maxLength={700}
                placeholder="Lời dẫn vắn tắt hoặc câu thoại đặc trưng nổi bật nhất của nhân vật (Tối đa 700 ký tự)..."
                className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>

            {/* Creator Note */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-neutral-300">
                Creator Note (Ghi chú của Tác giả)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Những lưu ý, lời nhắn hoặc hướng dẫn cài đặt bổ sung từ Creator cho người chơi..."
                className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Section 3: Tags (Max 12 tags) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-widest">
                <TagIcon className="w-4 h-4" />
                <span>3. Tag phân loại (Tối đa 12 tag)</span>
              </div>
              <span className="text-xs font-mono font-semibold text-neutral-400">
                Đã thêm {tags.length}/12 tag
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={tags.length >= 12}
                placeholder={tags.length >= 12 ? "Đã đạt tối đa 12 tag" : "Nhập tên tag (VD: modern, romance, fantasy)..."}
                className="flex-1 px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={tags.length >= 12 || !tagInput.trim()}
                className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors whitespace-nowrap"
              >
                Thêm Tag
              </button>
            </div>

            {/* Display Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-neutral-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}

              {tags.length === 0 && (
                <p className="text-xs text-neutral-500 italic">Chưa có tag nào được thêm. Tag giúp người dùng dễ dàng tìm thấy Character của bạn.</p>
              )}
            </div>
          </div>

          {/* Section 4: Plot (Cốt truyện) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-widest">
              <Quote className="w-4 h-4" />
              <span>4. Cốt truyện (Plot)</span>
              <span className="text-red-500">*</span>
            </div>

            <textarea
              rows={8}
              value={plot}
              onChange={e => setPlot(e.target.value)}
              placeholder="Chi tiết cốt truyện, thế giới quan, quy tắc ứng xử, tính cách và bối cảnh chính của nhân vật..."
              className="w-full px-4 py-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors leading-relaxed"
            />
          </div>

          {/* Section 5: Opening Scene (Cảnh Mở Đầu) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-widest">
              <MessageSquare className="w-4 h-4" />
              <span>5. Cảnh Mở Đầu (Opening Scene)</span>
            </div>

            <textarea
              rows={5}
              value={openingScene}
              onChange={e => setOpeningScene(e.target.value)}
              placeholder="Đoạn văn mở đầu cuộc trò chuyện / Lời chào đầu tiên khi khởi tạo trò chơi..."
              className="w-full px-4 py-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors leading-relaxed"
            />
          </div>

          {/* Section 6: Link Character Selection */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-widest">
                <LinkIcon className="w-4 h-4" />
                <span>6. Link Character Google AI Studio</span>
                <span className="text-red-500">*</span>
              </div>

              {/* Status Radio Group */}
              <div className="flex items-center gap-3 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setHasLink(true);
                    if (links.length === 0) setLinks(['']);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    hasLink 
                      ? 'bg-amber-500 text-black shadow-md' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã Có Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHasLink(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    !hasLink 
                      ? 'bg-neutral-700 text-white shadow-md' 
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <X className="w-4 h-4" />
                  <span>Chưa Có Link</span>
                </button>
              </div>
            </div>

            {/* Link Inputs Container */}
            {hasLink ? (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Nhập đường dẫn trực tiếp Google AI Studio cho Character. Bạn có thể nhấn nút <strong className="text-amber-500 font-semibold">(+) Thêm link Character</strong> để bổ sung nhiều phiên bản link khác nhau.
                </p>

                <div className="space-y-3">
                  {links.map((linkVal, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 focus-within:border-amber-500 transition-colors">
                        <LinkIcon className="w-4 h-4 text-neutral-500 shrink-0" />
                        <input
                          type="url"
                          value={linkVal}
                          onChange={e => handleLinkChange(index, e.target.value)}
                          placeholder="https://aistudio.google.com/..."
                          className="w-full bg-transparent text-sm text-white focus:outline-none"
                        />
                      </div>

                      {links.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLinkField(index)}
                          className="p-3 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition-colors shrink-0"
                          title="Xóa link này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addLinkField}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm link Character</span>
                </button>
              </div>
            ) : (
              <div className="bg-neutral-950 border border-neutral-800/80 rounded-2xl p-4 text-xs text-neutral-400 flex items-center gap-3">
                <Info className="w-5 h-5 text-neutral-500 shrink-0" />
                <span>Bạn đang chọn <strong>"Chưa Có Link"</strong>. Nút mở link của Character này sẽ hiển thị trạng thái chưa sẵn sàng cho người dùng.</span>
              </div>
            )}
          </div>

          {/* Bottom Action Submit Button */}
          <div className="pt-6 border-t border-neutral-800 flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3.5 rounded-xl bg-white text-black font-black uppercase text-xs tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-50 shadow-xl flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{id ? "Lưu thay đổi" : "Đăng Character ngay"}</span>
              )}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}
