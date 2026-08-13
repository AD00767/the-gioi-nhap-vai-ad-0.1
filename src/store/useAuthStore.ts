import { create } from 'zustand';
import { User, getCurrentUser, setCurrentUserId, getUserById, registerUser, updateUser } from '../lib/localDb';
import { auth, db } from '../lib/firebase';
import { doc } from 'firebase/firestore';
import { safeSetDoc } from '../lib/firestoreUtils';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut,
  updateProfile
} from 'firebase/auth';

interface AuthState {
  user: User | null;
  firebaseUser: any | null; // Kept for backward compatibility with component props
  isInitialized: boolean;
  setAuth: (firebaseUser: any, user: User | null) => void;
  setUser: (user: User | null) => void;
  setInitialized: (val: boolean) => void;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password?: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetAdminPassword: (email: string, pin: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  isInitialized: false,

  setAuth: (firebaseUser, user) => {
    if (user) {
      setCurrentUserId(user.id);
      localStorage.setItem('cached_user_role', user.role);
      localStorage.setItem('cached_creator_status', String(user.creatorStatus));
      // Background sync to Firestore
      try {
        safeSetDoc(doc(db, 'users', user.id), user);
      } catch (err) {
        console.warn("Background user sync failed:", err);
      }
    } else {
      setCurrentUserId(null);
    }
    set({ user, firebaseUser: user ? { uid: user.id, email: user.email, displayName: user.displayName, photoURL: user.avatar } : null });
  },

  setUser: (user) => {
    if (user) {
      setCurrentUserId(user.id);
      // Background sync to Firestore
      try {
        safeSetDoc(doc(db, 'users', user.id), user);
      } catch (err) {
        console.warn("Background user sync failed:", err);
      }
    } else {
      setCurrentUserId(null);
    }
    set({ user, firebaseUser: user ? { uid: user.id, email: user.email, displayName: user.displayName, photoURL: user.avatar } : null });
  },

  setInitialized: (val) => set({ isInitialized: val }),

  login: async (email, password) => {
    try {
      if (!email || !password) {
        return { success: false, error: 'Vui lòng điền đầy đủ email và mật khẩu.' };
      }
      
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = cred.user;
      
      const isOwner = email.toLowerCase() === 'nhuochy259@gmail.com';
      let localUser = getUserById(firebaseUser.uid);
      
      if (!localUser) {
        // Register locally since they logged in via Firebase Auth but don't have a local profile
        const regRes = registerUser(
          email,
          undefined, // Do not store password locally
          firebaseUser.displayName || email.split('@')[0],
          isOwner ? 'ADMIN' : 'USER',
          isOwner ? true : false,
          firebaseUser.uid
        );
        localUser = regRes.user;
      } else {
        // Auto-upgrade owner to ADMIN and Creator if they are not already
        if (isOwner && (localUser.role !== 'ADMIN' || !localUser.creatorStatus)) {
          updateUser(localUser.id, { role: 'ADMIN', creatorStatus: true });
          localUser = getUserById(firebaseUser.uid);
        }
      }

      if (localUser) {
        get().setAuth(firebaseUser, localUser);
        return { success: true };
      }
      return { success: false, error: 'Không thể khởi tạo tài khoản trong hệ thống.' };
    } catch (err: any) {
      console.error("Firebase Auth login failed:", err);
      let errorMsg = 'Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Mật khẩu hoặc email không chính xác.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Định dạng email không hợp lệ.';
      } else if (err.code === 'auth/user-disabled') {
        errorMsg = 'Tài khoản của bạn đã bị vô hiệu hóa.';
      }
      return { success: false, error: errorMsg };
    }
  },

  register: async (email, password, displayName) => {
    try {
      if (!email || !password) {
        return { success: false, error: 'Vui lòng điền đầy đủ thông tin đăng ký.' };
      }
      
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = cred.user;

      if (displayName) {
        try {
          await updateProfile(firebaseUser, { displayName });
        } catch (profileErr) {
          console.warn("Failed to set Firebase Auth displayName:", profileErr);
        }
      }

      const isOwner = email.toLowerCase() === 'nhuochy259@gmail.com';
      const regRes = registerUser(
        email,
        undefined, // Do not store password locally
        displayName || email.split('@')[0],
        isOwner ? 'ADMIN' : 'USER',
        isOwner ? true : false,
        firebaseUser.uid
      );

      if (regRes.error) {
        return { success: false, error: regRes.error };
      }

      get().setAuth(firebaseUser, regRes.user);
      return { success: true };
    } catch (err: any) {
      console.error("Firebase Auth register failed:", err);
      let errorMsg = 'Đăng ký thất bại. Vui lòng thử lại.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Địa chỉ email này đã được sử dụng.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Mật khẩu yếu. Vui lòng nhập mật khẩu dài hơn (tối thiểu 6 ký tự).';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Định dạng email không hợp lệ.';
      }
      return { success: false, error: errorMsg };
    }
  },

  forgotPassword: async (email) => {
    try {
      if (!email) {
        return { success: false, error: 'Vui lòng điền email.' };
      }
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (err: any) {
      console.error("Firebase sendPasswordResetEmail failed:", err);
      let errorMsg = 'Gửi email khôi phục mật khẩu thất bại. Vui lòng thử lại.';
      if (err.code === 'auth/user-not-found') {
        errorMsg = 'Không tìm thấy tài khoản với email này.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Định dạng email không hợp lệ.';
      }
      return { success: false, error: errorMsg };
    }
  },

  resetAdminPassword: async (email, pin, newPassword) => {
    try {
      if (!email || !pin || !newPassword) {
        return { success: false, error: 'Vui lòng nhập đầy đủ email, mã PIN và mật khẩu mới.' };
      }
      const response = await fetch('/api/auth/reset-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, pin, newPassword }),
      });
      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        return { 
          success: false, 
          error: `Máy chủ phản hồi không đúng định dạng JSON (Mã: ${response.status}). Chi tiết: ${responseText.slice(0, 100)}` 
        };
      }
      if (response.ok && data.success) {
        return { success: true };
      } else {
        return { success: false, error: data.error || `Yêu cầu thất bại (Mã: ${response.status}).` };
      }
    } catch (err: any) {
      console.error("resetAdminPassword API error:", err);
      return { success: false, error: `Kết nối máy chủ thất bại: ${err?.message || err}` };
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Firebase Auth signOut failed:", err);
    }
    setCurrentUserId(null);
    set({ user: null, firebaseUser: null });
  },

  refreshUser: () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      get().setUser(currentUser);
    }
  },
}));
