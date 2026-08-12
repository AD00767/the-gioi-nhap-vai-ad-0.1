import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { loginWithGoogle } from "../lib/firebase";
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

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleLoginClick = async () => {
    try {
      await loginWithGoogle();
      toast.success("Đăng nhập bằng Google thành công!");
    } catch (e: any) {
      if (e?.code === 'auth/popup-closed-by-user') return;
      if (e?.code === 'auth/network-request-failed') {
        toast.error("Không thể kết nối dịch vụ Google Auth. Vui lòng thử lại.");
      } else {
        toast.error("Đăng nhập không thành công. Vui lòng thử lại.");
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
    </div>
  );
}
