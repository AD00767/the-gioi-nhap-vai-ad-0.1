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
  const [authMode, setAuthMode] = React.useState<'LOGIN' | 'REGISTER' | 'FORGOT' | 'ADMIN_RESET'>('LOGIN');
  const [adminPin, setAdminPin] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleLoginClick = () => {
    setAuthMode('LOGIN');
    setShowLoginModal(true);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { login, register, forgotPassword } = useAuthStore.getState();

    if (authMode === 'LOGIN') {
      if (!email.trim() || !password) {
        toast.error("Vui lòng điền đầy đủ Email và Mật khẩu.");
        return;
      }
      setLoading(true);
      const res = await login(email.trim(), password);
      setLoading(false);
      if (res.success) {
        toast.success("Đăng nhập thành công!");
        setShowLoginModal(false);
      } else {
        toast.error(res.error || "Đăng nhập thất bại.");
      }
    } else if (authMode === 'REGISTER') {
      if (!email.trim() || !password || !confirmPassword) {
        toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Mật khẩu nhập lại không khớp.");
        return;
      }
      if (password.length < 6) {
        toast.error("Mật khẩu phải dài tối thiểu 6 ký tự.");
        return;
      }
      setLoading(true);
      const res = await register(email.trim(), password, displayName.trim() || undefined);
      setLoading(false);
      if (res.success) {
        toast.success("Đăng ký tài khoản mới thành công!");
        setShowLoginModal(false);
      } else {
        toast.error(res.error || "Đăng ký thất bại.");
      }
    } else if (authMode === 'FORGOT') {
      if (!email.trim()) {
        toast.error("Vui lòng nhập Email để khôi phục mật khẩu.");
        return;
      }
      setLoading(true);
      const res = await forgotPassword(email.trim());
      setLoading(false);
      if (res.success) {
        toast.success("Đã gửi liên kết khôi phục mật khẩu tới email của bạn!");
        setAuthMode('LOGIN');
      } else {
        toast.error(res.error || "Gửi yêu cầu thất bại.");
      }
    } else if (authMode === 'ADMIN_RESET') {
      if (!email.trim() || !adminPin || !password) {
        toast.error("Vui lòng điền đầy đủ Email, Mã PIN và Mật khẩu mới.");
        return;
      }
      setLoading(true);
      const { resetAdminPassword } = useAuthStore.getState();
      const res = await resetAdminPassword(email.trim(), adminPin, password);
      setLoading(false);
      if (res.success) {
        toast.success("Đổi mật khẩu tài khoản Admin thành công! Vui lòng đăng nhập với mật khẩu mới.");
        setAuthMode('LOGIN');
        setPassword('');
        setAdminPin('');
      } else {
        toast.error(res.error || "Đặt lại mật khẩu thất bại.");
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
            
            {/* Header depending on current mode */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">
                {authMode === 'LOGIN' && 'Đăng Nhập'}
                {authMode === 'REGISTER' && 'Đăng Ký Tài Khoản'}
                {authMode === 'FORGOT' && 'Quên Mật Khẩu'}
                {authMode === 'ADMIN_RESET' && 'Khôi Phục Admin Direct'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                {authMode === 'LOGIN' && 'Nhập email và mật khẩu của bạn để tiếp tục.'}
                {authMode === 'REGISTER' && 'Tạo tài khoản mới để bắt đầu cuộc hành trình.'}
                {authMode === 'FORGOT' && 'Nhập email để nhận liên kết khôi phục mật khẩu.'}
                {authMode === 'ADMIN_RESET' && 'Đặt lại mật khẩu trực tiếp bằng mã PIN bí mật.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              {/* Optional Display Name for registration */}
              {authMode === 'REGISTER' && (
                <div>
                  <label className="block text-xs font-black tracking-widest uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                    Tên hiển thị (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Lữ Khách Cô Đơn"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-black tracking-widest uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="nhap_email@cua_ban.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>

              {/* Admin Secret PIN */}
              {authMode === 'ADMIN_RESET' && (
                <div>
                  <label className="block text-xs font-black tracking-widest uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                    Mã PIN Admin Bí Mật
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mã PIN Admin..."
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>
              )}

              {/* Password for Login, Register & Admin Reset */}
              {authMode !== 'FORGOT' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black tracking-widest uppercase text-neutral-500 dark:text-neutral-400">
                      {authMode === 'ADMIN_RESET' ? 'Mật khẩu mới' : 'Mật khẩu'}
                    </label>
                    {authMode === 'LOGIN' && (
                      <button
                        type="button"
                        onClick={() => setAuthMode('FORGOT')}
                        className="text-xs font-bold text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                      >
                        Quên mật khẩu?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    placeholder={authMode === 'ADMIN_RESET' ? "Nhập mật khẩu mới..." : "Nhập mật khẩu..."}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>
              )}

              {/* Confirm Password for Register */}
              {authMode === 'REGISTER' && (
                <div>
                  <label className="block text-xs font-black tracking-widest uppercase text-neutral-500 dark:text-neutral-400 mb-2">
                    Nhập lại mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Xác nhận mật khẩu..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>
              )}

              {/* Dynamic Hints/Warnings */}
              {email.trim().toLowerCase() === 'nhuochy259@gmail.com' && (
                <div className="p-3 bg-neutral-100 dark:bg-neutral-900 rounded-lg text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  💡 Email quản trị viên: Hệ thống tự gán quyền ADMIN sau khi đăng nhập thành công.
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black font-black rounded-xl text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {authMode === 'LOGIN' && 'ĐĂNG NHẬP'}
                      {authMode === 'REGISTER' && 'ĐĂNG KÝ'}
                      {authMode === 'FORGOT' && 'GỬI YÊU CẦU'}
                      {authMode === 'ADMIN_RESET' && 'XÁC NHẬN ĐỔI MẬT KHẨU'}
                    </>
                  )}
                </button>
              </div>

              {/* Mode toggles */}
              <div className="border-t border-neutral-100 dark:border-neutral-900 mt-4 pt-4 text-center text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                {authMode === 'LOGIN' && (
                  <div>
                    Bạn chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('REGISTER');
                        setEmail('');
                        setPassword('');
                        setConfirmPassword('');
                        setDisplayName('');
                      }}
                      className="font-black text-black dark:text-white underline ml-1"
                    >
                      Đăng ký ngay
                    </button>
                  </div>
                )}
                {authMode === 'REGISTER' && (
                  <div>
                    Bạn đã có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('LOGIN');
                        setEmail('');
                        setPassword('');
                      }}
                      className="font-black text-black dark:text-white underline ml-1"
                    >
                      Đăng nhập
                    </button>
                  </div>
                )}
                {authMode === 'FORGOT' && (
                  <div className="flex flex-col gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setAuthMode('LOGIN')}
                      className="font-black text-black dark:text-white underline"
                    >
                      Quay lại Đăng nhập
                    </button>
                    {email.trim().toLowerCase() === 'nhuochy259@gmail.com' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('ADMIN_RESET');
                          setAdminPin('');
                          setPassword('');
                        }}
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline mt-2"
                      >
                        💡 Bạn là Admin? Nhấp vào đây để đổi mật khẩu bằng PIN Admin trực tiếp
                      </button>
                    )}
                  </div>
                )}
                {authMode === 'ADMIN_RESET' && (
                  <button
                    type="button"
                    onClick={() => setAuthMode('LOGIN')}
                    className="font-black text-black dark:text-white underline"
                  >
                    Quay lại Đăng nhập
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
