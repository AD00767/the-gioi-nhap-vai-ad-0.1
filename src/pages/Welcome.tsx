import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import * as localDb from "../lib/localDb";
import { Compass, LogIn } from "lucide-react";
import { motion } from "motion/react";
import { useSeo } from "../hooks/useSeo";
import toast from "react-hot-toast";

export default function Welcome() {
  const { user } = useAuthStore();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/home";

  useSeo({
    title: 'Chào Mừng',
    description: 'Thế giới nhập vai_AD - Khởi đầu cho mọi hành trình Roleplay trên Google AI Studio. Khám phá Character, Prompt và kết nối với cộng đồng Creator.'
  });

  const [showLoginModal, setShowLoginModal] = React.useState(false);
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("123456");

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  const handleLocalLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      toast.error("Vui lòng nhập tên đăng nhập hoặc email.");
      return;
    }

    const emailOrUser = loginEmail.trim();
    const cleanKey = emailOrUser.toLowerCase();
    const isOwner = cleanKey === 'nhuochy259@gmail.com';

    const { login, register, refreshUser } = useAuthStore.getState();
    const allUsers = localDb.getAllUsers();
    
    const existing = allUsers.find(
      u => u.email.toLowerCase() === cleanKey || u.displayName.toLowerCase() === cleanKey
    );

    if (existing) {
      if (isOwner && (existing.role !== 'ADMIN' || !existing.creatorStatus)) {
        localDb.updateUser(existing.id, { role: 'ADMIN', creatorStatus: true });
        refreshUser();
      }
      const res = login(emailOrUser, loginPassword);
      if (res.success) {
        toast.success("Đăng nhập thành công!");
        setShowLoginModal(false);
      } else {
        toast.error(res.error || "Mật khẩu không chính xác.");
      }
    } else {
      const role = isOwner ? 'ADMIN' : 'USER';
      const creatorStatus = isOwner ? true : false;
      const regRes = register(emailOrUser, loginPassword, emailOrUser.split('@')[0]);
      if (regRes.success) {
        const currentUser = useAuthStore.getState().user;
        if (currentUser && isOwner) {
          localDb.updateUser(currentUser.id, { role: 'ADMIN', creatorStatus: true });
          refreshUser();
        }
        toast.success("Đăng ký & Đăng nhập tài khoản mới thành công!");
        setShowLoginModal(false);
      } else {
        toast.error(regRes.error || "Đăng nhập thất bại.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Header hidden as requested */}
      <header className="opacity-0 pointer-events-none p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="font-bold text-2xl tracking-tighter uppercase">Thế Giới Nhập Vai AD</div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-neutral-100 dark:bg-neutral-900/40 rounded-full blur-[80px] sm:blur-[100px] -z-10 opacity-50" />
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-neutral-50 dark:bg-neutral-900/20 rounded-full blur-[60px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-neutral-50 dark:bg-neutral-900/20 rounded-full blur-[60px] -z-10" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 sm:mb-8"
          >
            <span className="inline-block px-3 py-1 mb-6 text-[9px] sm:text-[10px] font-bold tracking-[0.3em] uppercase bg-black dark:bg-white text-white dark:text-black rounded-sm shadow-lg">
              Google AI Studio Community
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter mb-4 leading-tight drop-shadow-sm px-2 uppercase text-neutral-900 dark:text-white" style={{ fontFamily: 'Verdana, sans-serif' }}>
              THẾ GIỚI NHẬP VAI AD
            </h1>
            <p className="text-sm sm:text-lg md:text-xl font-bold tracking-[0.1em] text-neutral-500 uppercase px-4">
              Khởi đầu cho mọi hành trình Roleplay
            </p>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-xs sm:text-base md:text-lg text-neutral-400 dark:text-neutral-500 mb-10 sm:mb-12 max-w-lg sm:max-w-xl mx-auto leading-relaxed font-medium px-6"
          >
            Khám phá, chia sẻ và kết nối thông qua các Character, Prompt chất lượng cao dành riêng cho người dùng Google AI Studio.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 px-8 sm:px-0"
          >
            <Link 
              to="/home" 
              className="group relative flex items-center justify-center gap-3 px-8 sm:px-10 py-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-black text-base sm:text-lg overflow-hidden transition-all hover:scale-[1.03] active:scale-[0.97] shadow-xl hover:shadow-neutral-400/20 dark:hover:shadow-white/10"
            >
              <Compass className="w-5 h-5 transition-transform group-hover:rotate-45" />
              <span>BẮT ĐẦU</span>
            </Link>
            <button 
              onClick={handleLoginClick} 
              className="flex items-center justify-center gap-3 px-8 sm:px-10 py-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-800 text-black dark:text-white font-black text-base sm:text-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all hover:scale-[1.03] active:scale-[0.97]"
            >
              <LogIn className="w-5 h-5" />
              <span>ĐĂNG NHẬP</span>
            </button>
          </motion.div>
        </div>
      </main>

      <footer className="p-8 text-center border-t border-neutral-100 dark:border-neutral-900 w-full">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold tracking-widest uppercase text-neutral-400">
          <div>&copy; 2026 Thế Giới Nhập Vai AD</div>
          <div className="flex gap-8">
            <Link to="/contact" className="hover:text-black dark:hover:text-white transition-colors">Liên hệ</Link>
            <button className="hover:text-black dark:hover:text-white transition-colors">Điều khoản</button>
            <button className="hover:text-black dark:hover:text-white transition-colors">Bảo mật</button>
          </div>
        </div>
      </footer>

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">
                Đăng Nhập Hệ Thống
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                Hệ thống lưu trữ tài khoản trực tiếp trong trình duyệt qua LocalStorage.
              </p>
            </div>

            <form onSubmit={handleLocalLoginSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-black tracking-widest uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                  Tên đăng nhập hoặc Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên tài khoản hoặc email..."
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black tracking-widest uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                  Mật khẩu (Mặc định: 123456)
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu..."
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>

              {loginEmail.trim().toLowerCase() === 'nhuochy259@gmail.com' && (
                <div className="p-3 bg-neutral-100 dark:bg-neutral-900 rounded-lg text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  💡 Email chủ sở hữu: Bạn sẽ đăng nhập với vai trò ADMIN hệ thống.
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black font-black rounded-xl text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
