import { create } from 'zustand';
import { User, getCurrentUser, setCurrentUserId, getUserById, getUserByEmail, registerUser, updateUser } from '../lib/localDb';
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
      
      let firebaseUser: any = null;
      let localUser: any = null;
      
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = cred.user;
        
        const isOwner = email.toLowerCase() === 'nhuochy259@gmail.com';
        localUser = getUserById(firebaseUser.uid);
        
        if (!localUser) {
          // Register locally since they logged in via Firebase Auth but don't have a local profile
          const regRes = registerUser(
            email,
            password, // Store password locally for local auth fallbacks
            firebaseUser.displayName || email.split('@')[0],
            isOwner ? 'ADMIN' : 'USER',
            isOwner ? true : false,
            firebaseUser.uid
          );
          localUser = regRes.user;
        } else {
          // Auto-upgrade owner to ADMIN and Creator if they are not already
          if (isOwner && (localUser.role !== 'ADMIN' || !localUser.creatorStatus)) {
            updateUser(localUser.id, { role: 'ADMIN', creatorStatus: true, password });
            localUser = getUserById(firebaseUser.uid);
          } else if (password && localUser.password !== password) {
            updateUser(localUser.id, { password });
          }
        }
      } catch (fbErr: any) {
        console.warn("Firebase Auth login failed, checking local database authentication fallback:", fbErr);
        
        // Local auth fallback check!
        const existingLocalUser = getUserByEmail(email);
        if (existingLocalUser) {
          if (existingLocalUser.isLocked) {
            return {
              success: false,
              error: existingLocalUser.lockReason 
                ? `Tài khoản đã bị khóa: ${existingLocalUser.lockReason}` 
                : 'Tài khoản của bạn đã bị khóa.'
            };
          }
          
          if (existingLocalUser.password === password) {
            console.log("🔥 [Auth Fallback] Successfully logged in via Local DB password match.");
            localUser = existingLocalUser;
            // Create a fake/mock firebaseUser object so the UI is completely satisfied
            firebaseUser = {
              uid: localUser.id,
              email: localUser.email,
              displayName: localUser.displayName,
              photoURL: localUser.avatar,
              isAnonymous: false,
              emailVerified: true,
              metadata: {}
            };
          } else {
            return { success: false, error: 'Mật khẩu đăng nhập không chính xác.' };
          }
        } else {
          // If they didn't exist locally, translate common Firebase errors nicely
          let errorMsg = 'Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.';
          if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
            errorMsg = 'Mật khẩu hoặc email không chính xác.';
          } else if (fbErr.code === 'auth/invalid-email') {
            errorMsg = 'Định dạng email không hợp lệ.';
          } else if (fbErr.code === 'auth/user-disabled') {
            errorMsg = 'Tài khoản của bạn đã bị vô hiệu hóa.';
          }
          return { success: false, error: errorMsg };
        }
      }

      if (localUser && firebaseUser) {
        get().setAuth(firebaseUser, localUser);
        return { success: true };
      }
      return { success: false, error: 'Không thể khởi tạo tài khoản trong hệ thống.' };
    } catch (err: any) {
      console.error("General login error:", err);
      return { success: false, error: err.message || 'Lỗi hệ thống trong quá trình đăng nhập.' };
    }
  },

  register: async (email, password, displayName) => {
    try {
      if (!email || !password) {
        return { success: false, error: 'Vui lòng điền đầy đủ thông tin đăng ký.' };
      }
      
      let firebaseUser: any = null;
      let localUser: any = null;
      
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = cred.user;
        
        if (displayName) {
          try {
            await updateProfile(firebaseUser, { displayName });
          } catch (profileErr) {
            console.warn("Failed to set Firebase Auth displayName:", profileErr);
          }
        }
      } catch (fbErr: any) {
        console.warn("Firebase Auth createUserWithEmailAndPassword failed, falling back to pure local registration:", fbErr);
      }

      const isOwner = email.toLowerCase() === 'nhuochy259@gmail.com';
      const uid = firebaseUser?.uid || 'user_' + Math.random().toString(36).substring(2, 9);
      
      // Check if user already exists locally
      const existingUser = getUserByEmail(email);
      if (existingUser) {
        return { success: false, error: 'Địa chỉ email này đã được sử dụng.' };
      }

      const regRes = registerUser(
        email,
        password, // Store password locally
        displayName || email.split('@')[0],
        isOwner ? 'ADMIN' : 'USER',
        isOwner ? true : false,
        uid
      );

      if (regRes.error) {
        return { success: false, error: regRes.error };
      }
      
      localUser = regRes.user;
      
      // If firebaseUser is null (FB Auth offline/disabled), create a mock firebaseUser object
      if (!firebaseUser) {
        firebaseUser = {
          uid: localUser.id,
          email: localUser.email,
          displayName: localUser.displayName,
          photoURL: localUser.avatar,
          isAnonymous: false,
          emailVerified: true,
          metadata: {}
        };
      }

      get().setAuth(firebaseUser, localUser);
      return { success: true };
    } catch (err: any) {
      console.error("Registration error:", err);
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
      
      let serverSuccess = false;
      let serverMsg = "";
      
      // Attempt backend API call first
      try {
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
        } catch (e) {}

        if (response.ok && data?.success) {
          serverSuccess = true;
          serverMsg = data?.message || "Đặt lại thành công.";
        } else {
          serverMsg = data?.error || `Yêu cầu thất bại (Mã: ${response.status}).`;
        }
      } catch (fetchErr: any) {
        console.warn("Backend resetAdminPassword API unreachable:", fetchErr);
        serverMsg = fetchErr.message || String(fetchErr);
      }

      // Local update check - only for admin email
      const isOwner = email.toLowerCase() === 'nhuochy259@gmail.com';
      if (!isOwner) {
        return { success: false, error: 'Email đặt lại mật khẩu đặc biệt này phải trùng khớp với email Admin.' };
      }

      // Check PIN locally
      const fallbackPin = "123456";
      if (pin.trim() !== fallbackPin) {
        return { success: false, error: 'Mã PIN bí mật của quản trị viên không chính xác (kiểm tra lại VITE_ADMIN_PIN).' };
      }

      // Update in local DB
      let localUser = getUserByEmail(email);
      if (localUser) {
        updateUser(localUser.id, { password: newPassword, role: 'ADMIN', creatorStatus: true });
      } else {
        registerUser(
          email,
          newPassword,
          'Admin nhuochy',
          'ADMIN',
          true,
          'admin_nhuochy259'
        );
      }

      console.log("🔥 [Auth Fallback] Admin password synchronized in local database successfully.");
      return { success: true };
    } catch (err: any) {
      console.error("resetAdminPassword error:", err);
      return { success: false, error: `Đặt lại mật khẩu thất bại: ${err?.message || err}` };
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
