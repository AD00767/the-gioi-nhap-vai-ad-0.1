import { create } from 'zustand';
import { User, getCurrentUser, setCurrentUserId, loginUser, registerUser, updateUser } from '../lib/localDb';

interface AuthState {
  user: User | null;
  firebaseUser: any | null; // Kept for backward compatibility with component props
  isInitialized: boolean;
  setAuth: (firebaseUser: any, user: User | null) => void;
  setUser: (user: User | null) => void;
  setInitialized: (val: boolean) => void;
  login: (emailOrUsername: string, password?: string) => { success: boolean; error?: string };
  register: (email: string, password?: string, displayName?: string) => { success: boolean; error?: string };
  logout: () => void;
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
    } else {
      setCurrentUserId(null);
    }
    set({ user, firebaseUser: user ? { uid: user.id, email: user.email, displayName: user.displayName, photoURL: user.avatar } : null });
  },

  setUser: (user) => {
    if (user) {
      setCurrentUserId(user.id);
    } else {
      setCurrentUserId(null);
    }
    set({ user, firebaseUser: user ? { uid: user.id, email: user.email, displayName: user.displayName, photoURL: user.avatar } : null });
  },

  setInitialized: (val) => set({ isInitialized: val }),

  login: (emailOrUsername, password) => {
    const result = loginUser(emailOrUsername, password);
    if (result.user) {
      get().setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error || 'Đăng nhập thất bại.' };
  },

  register: (email, password, displayName) => {
    const result = registerUser(email, password, displayName);
    if (result.user && !result.error) {
      get().setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error || 'Đăng ký thất bại.' };
  },

  logout: () => {
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
