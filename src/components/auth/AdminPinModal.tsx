import React, { useState } from 'react';
import { ShieldAlert, KeyRound, CheckCircle2, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { verifyAdminPin, getAdminEmail } from '../../lib/adminAuth';
import toast from 'react-hot-toast';

interface AdminPinModalProps {
  isOpen: boolean;
  userEmail?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AdminPinModal({ isOpen, userEmail, onSuccess, onCancel }: AdminPinModalProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!pin.trim()) {
      setErrorMsg('Vui lòng nhập mã PIN Admin.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = verifyAdminPin(pin);
      if (res.success) {
        toast.success('Xác thực PIN Admin thành công! Đã mở khóa quyền Admin.');
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Mã PIN không đúng.');
        toast.error('Mã PIN không đúng.');
      }
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
        
        {/* Header Icon */}
        <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="text-center space-y-1.5 mb-6">
          <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 uppercase">
            Bảo Mật Admin 2 Lớp
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Yêu cầu lớp bảo mật PIN bí mật để mở khóa Bảng Quản Trị
          </p>
        </div>

        {/* Security Checks Status */}
        <div className="space-y-2 mb-6">
          {/* Layer 1 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Lớp 1: Khớp Email Admin</span>
            </div>
            <span className="font-mono text-[11px] text-neutral-600 dark:text-neutral-300 truncate max-w-[150px]">
              {userEmail || getAdminEmail()}
            </span>
          </div>

          {/* Layer 2 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>Lớp 2: Mã PIN Bí Mật</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
              Yêu cầu PIN
            </span>
          </div>
        </div>

        {/* PIN Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2 uppercase tracking-wider">
              Nhập mã PIN Admin (từ VITE_ADMIN_PIN)
            </label>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-mono tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5 text-center">
              * Mã PIN được cấu hình qua biến môi trường <code className="text-amber-500">VITE_ADMIN_PIN</code>
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium text-center">
              {errorMsg}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold transition-all shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              {isSubmitting ? 'Đang kiểm tra...' : 'Mở khóa Admin'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
