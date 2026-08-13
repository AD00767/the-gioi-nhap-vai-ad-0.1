import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  Home, Compass, User as UserIcon, BookOpen, PenTool, 
  MessageSquare, Bell, Settings, LogIn, Menu, X, Sparkles, LayoutDashboard, Mail, ShieldAlert, ShieldCheck,
  Sun, Moon, Laptop, Search
} from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { loginWithGoogle, logout, db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from "firebase/firestore";
import toast from "react-hot-toast";
import clsx from "clsx";
import ThemeToggle from "../ThemeToggle";
import { applyTheme, ThemeMode } from "../../lib/themeFont";
import { parseIdQuery, lookupIdInFirebase } from "../../lib/searchUtils";
import * as localDb from "../../lib/localDb";
import { isUserAdminEmail } from "../../lib/adminAuth";

export default function Layout() {
  const { user, isInitialized } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('app_theme_mode') as ThemeMode) || 'SYSTEM';
  });
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const handleHeaderSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = headerSearchQuery.trim();
    if (!queryStr) return;

    const idParse = parseIdQuery(queryStr);
    if (idParse.isIdQuery) {
      if (idParse.error) {
        toast.error(idParse.error);
        navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
        setHeaderSearchQuery("");
        return;
      }

      if (idParse.numericId) {
        try {
          const lookup = await lookupIdInFirebase(idParse.numericId, idParse.typeHint);
          if (lookup && lookup.found && lookup.path) {
            toast.success("Đã tìm thấy đối tượng chính xác theo ID!");
            setHeaderSearchQuery("");
            navigate(lookup.path);
            return;
          } else {
            const errorMsg = lookup?.error || "Mã ID không tồn tại trên hệ thống.";
            toast.error(errorMsg);
            navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
            setHeaderSearchQuery("");
            return;
          }
        } catch (err) {
          console.error("Exact lookup error in Header:", err);
          navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
          setHeaderSearchQuery("");
          return;
        }
      }
    }

    // Standard text queries redirect to search
    navigate(`/ai-search?q=${encodeURIComponent(queryStr)}`);
    setHeaderSearchQuery("");
  };

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail) {
        setCurrentTheme(customEvent.detail);
      }
    };
    window.addEventListener('app-theme-changed', handleThemeChange);
    return () => window.removeEventListener('app-theme-changed', handleThemeChange);
  }, []);

  const handleMobileThemeChange = async (mode: ThemeMode) => {
    setCurrentTheme(mode);
    applyTheme(mode);
    toast.success(
      mode === 'LIGHT' ? 'Đã chuyển sang Chế độ Sáng' :
      mode === 'DARK' ? 'Đã chuyển sang Chế độ Tối' :
      'Đã thiết lập Theo hệ thống'
    );
    if (user?.id) {
      try {
        await updateDoc(doc(db, 'users', user.id), { themePreference: mode });
      } catch (e) {
        console.error("Error saving theme preference to Firestore:", e);
      }
    }
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    if (!user) {
      setUnreadNotifCount(0);
      return;
    }

    const qRecipient = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.id),
      where('read', '==', false)
    );

    const qUser = query(
      collection(db, 'notifications'),
      where('userId', '==', user.id),
      where('read', '==', false)
    );

    let unreadRecipientIds = new Set<string>();
    let unreadUserIds = new Set<string>();

    const updateCount = () => {
      const combined = new Set([...unreadRecipientIds, ...unreadUserIds]);
      setUnreadNotifCount(combined.size);
    };

    const unsubRecipient = onSnapshot(qRecipient, (snapshot) => {
      unreadRecipientIds = new Set(snapshot.docs.map(doc => doc.id));
      updateCount();
    }, (err) => {
      console.log("Notice: Recipient notifications listener error (quota or network):", err);
    });

    const unsubUser = onSnapshot(qUser, (snapshot) => {
      unreadUserIds = new Set(snapshot.docs.map(doc => doc.id));
      updateCount();
    }, (err) => {
      console.log("Notice: User notifications listener error (quota or network):", err);
    });

    return () => {
      unsubRecipient();
      unsubUser();
    };
  }, [user?.id]);

  if (!isInitialized) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

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
    }
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    toast.success("Đã đăng xuất.");
  };

  const menuItems = [
    { label: "Trang chủ / Khám phá", path: "/", icon: <Compass className="w-5 h-5" /> },
    { label: "Character", path: "/characters", icon: <UserIcon className="w-5 h-5" /> },
    { label: "Prompt", path: "/prompts", icon: <PenTool className="w-5 h-5" /> },
    { label: "Creator", path: "/creators", icon: <BookOpen className="w-5 h-5" /> },
    { label: "Feedback", path: "/feedbacks", icon: <MessageSquare className="w-5 h-5" /> },
    { label: "Liên hệ", path: "/contact", icon: <Mail className="w-5 h-5" /> },
  ];

  if (user) {
    if (user.creatorStatus || user.role === 'ADMIN') {
      menuItems.push(
        { label: "Bảng điều khiển Creator", path: "/creator/dashboard", icon: <LayoutDashboard className="w-5 h-5 text-amber-500" /> }
      );
    }
    if (user.role === 'ADMIN' || isUserAdminEmail(user.email)) {
      menuItems.push(
        { label: "Quản trị & Kiểm duyệt", path: "/admin", icon: <ShieldAlert className="w-5 h-5 text-red-500" /> }
      );
    } else if (user.role === 'MOD' || user.role === 'MODERATOR') {
      menuItems.push(
        { label: "Moderator Panel", path: "/admin/users", icon: <ShieldCheck className="w-5 h-5 text-amber-500" /> }
      );
    }
    menuItems.push(
      { label: "Thông báo", path: "/notifications", icon: <Bell className="w-5 h-5" /> },
      { label: "Hồ sơ người dùng", path: "/profile", icon: <UserIcon className="w-5 h-5" /> },
      { label: "Cài đặt", path: "/settings", icon: <Settings className="w-5 h-5" /> }
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <Link to="/" className="text-xl font-bold tracking-tight shrink-0 uppercase">THẾ GIỚI NHẬP VAI AD</Link>
          </div>

          {/* Global Header Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
            <form onSubmit={handleHeaderSearchSubmit} className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Tìm kiếm Character, Prompt, ID (VD: character/12345)..."
                value={headerSearchQuery}
                onChange={e => setHeaderSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs md:text-sm rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:outline-none focus:ring-1 focus:ring-neutral-200 dark:focus:ring-neutral-800 transition-all text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500"
              />
            </form>
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/notifications" className="relative p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white" title="Thông báo">
                  <Bell className="w-5 h-5" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-black">
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </Link>
                <div className="group relative">
                  <button className="flex items-center gap-2">
                    <img src={user.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.displayName} alt="Avatar" className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-100 dark:border-neutral-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-2">
                      <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">Hồ sơ của tôi</Link>
                      {(user.creatorStatus || user.role === 'ADMIN' || isUserAdminEmail(user.email)) && (
                        <Link to="/creator/dashboard" className="block px-4 py-2 text-sm text-amber-600 dark:text-amber-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                          Bảng điều khiển Creator
                        </Link>
                      )}
                      {(user.role === 'ADMIN' || isUserAdminEmail(user.email)) && (
                        <Link to="/admin" className="block px-4 py-2 text-sm text-red-600 dark:text-red-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                          Quản trị & Kiểm duyệt
                        </Link>
                      )}
                      {(user.role === 'MOD' || user.role === 'MODERATOR') && (
                        <Link to="/admin/users" className="block px-4 py-2 text-sm text-amber-600 dark:text-amber-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                          Moderator Panel
                        </Link>
                      )}
                       <Link to="/settings" className="block px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">Cài đặt</Link>
                       <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">Đăng xuất</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={handleLoginClick} className="flex items-center gap-2 px-4 py-2 rounded-full bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors">
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:block w-64 shrink-0 py-8 pr-8 border-r border-neutral-200 dark:border-neutral-800/50">
          <nav className="space-y-1 sticky top-24">
            {menuItems.map(item => (
              <Link 
                key={item.path} 
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  location.pathname === item.path 
                    ? "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white" 
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:text-black dark:hover:text-white"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Sidebar Mobile Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-neutral-900 shadow-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setSidebarOpen(false)} className="p-2 -mr-2"><X className="w-5 h-5" /></button>
              </div>
              <nav className="space-y-2 flex-1 overflow-y-auto">
                {menuItems.map(item => (
                  <Link 
                    key={item.path} 
                    to={item.path}
                    className={clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                      location.pathname === item.path 
                        ? "bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white" 
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Mobile Theme Switcher */}
              <div className="pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1">
                  Giao diện (Theme)
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl">
                  <button
                    onClick={() => handleMobileThemeChange('LIGHT')}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all",
                      currentTheme === 'LIGHT'
                        ? "bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Sáng</span>
                  </button>
                  <button
                    onClick={() => handleMobileThemeChange('DARK')}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all",
                      currentTheme === 'DARK'
                        ? "bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <Moon className="w-4 h-4 text-blue-400" />
                    <span>Tối</span>
                  </button>
                  <button
                    onClick={() => handleMobileThemeChange('SYSTEM')}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-bold transition-all",
                      currentTheme === 'SYSTEM'
                        ? "bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <Laptop className="w-4 h-4 text-indigo-400" />
                    <span>Hệ thống</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

      {/* Main Content */}
      <main className="flex-1 w-full min-w-0 pb-10 lg:pb-0">
        <Outlet />
      </main>
    </div>

    {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-8 bg-white dark:bg-black mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-neutral-500">
          <p className="font-medium text-neutral-900 dark:text-neutral-100 mb-2 uppercase">THẾ GIỚI NHẬP VAI AD</p>
          <p className="mb-4">Khởi đầu cho mọi hành trình Roleplay.</p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Bảo mật</Link>
            <Link to="/terms" className="hover:text-black dark:hover:text-white transition-colors">Điều khoản</Link>
            <Link to="/contact" className="hover:text-black dark:hover:text-white transition-colors">Liên hệ</Link>
          </div>
          <p className="mt-8 text-xs opacity-50">&copy; 2026 THẾ GIỚI NHẬP VAI AD. All rights reserved.</p>
        </div>
      </footer>

      {showLoginModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl text-left">
            
            {/* Header depending on current mode */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white uppercase">
                {authMode === 'LOGIN' && 'Đăng Nhập'}
                {authMode === 'REGISTER' && 'Đăng Ký Tài Khoản'}
                {authMode === 'FORGOT' && 'Quên Mật Khẩu'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                {authMode === 'LOGIN' && 'Nhập email và mật khẩu của bạn để tiếp tục.'}
                {authMode === 'REGISTER' && 'Tạo tài khoản mới để bắt đầu cuộc hành trình.'}
                {authMode === 'FORGOT' && 'Nhập email để nhận liên kết khôi phục mật khẩu.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
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

              {/* Password for Login & Register */}
              {authMode !== 'FORGOT' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black tracking-widest uppercase text-neutral-500 dark:text-neutral-400">
                      Mật khẩu
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
                    placeholder="Nhập mật khẩu..."
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
