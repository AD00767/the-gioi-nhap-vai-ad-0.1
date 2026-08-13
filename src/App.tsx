/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { safeGetDoc, safeGetDocs, safeUpdateDoc } from './lib/firestoreUtils';
import { useAuthStore } from './store/useAuthStore';
import toast, { Toaster } from 'react-hot-toast';
import * as localDb from './lib/localDb';

import Layout from './components/layout/Layout';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Profile from './pages/Profile';
import AISearch from './pages/AISearch';
import CreatorDashboard from './pages/CreatorDashboard';
import Prompts from './pages/Prompts';
import Feedbacks from './pages/Feedbacks';
import Explore from './pages/Explore';
import Characters from './pages/Characters';
import Creators from './pages/Creators';
import Notifications from './pages/Notifications';
import Contact from './pages/Contact';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import CreateCharacter from './pages/CreateCharacter';
import DashboardStats from './pages/admin/DashboardStats';
import UserManagement from './pages/admin/UserManagement';
import ReportQueue from './pages/admin/ReportQueue';
import AuditLogs from './pages/admin/AuditLogs';
import BadgeManager from './pages/admin/BadgeManager';
import SupportManager from './pages/admin/SupportManager';
import AdminModeratorManager from './pages/admin/AdminModeratorManager';
import CreatorManager from './pages/admin/CreatorManager';
import CreatorDetail from './pages/CreatorDetail';
import CharacterDetail from './pages/CharacterDetail';
import PromptDetail from './pages/PromptDetail';
import { initThemeAndFont, applyTheme } from './lib/themeFont';
import ProtectedRoute from './components/auth/ProtectedRoute';

export default function App() {
  const { setAuth, setInitialized } = useAuthStore();

  useEffect(() => {
    initThemeAndFont();

    const initAuth = async () => {
      try {
        // Step 1: Ensure user is signed in to Firebase Auth anonymously so that direct Firestore operations succeed
        let firebaseUser = auth.currentUser;
        if (!firebaseUser) {
          try {
            const cred = await signInAnonymously(auth);
            firebaseUser = cred.user;
            console.log("Firebase anonymous authentication succeeded:", firebaseUser.uid);
          } catch (fireErr) {
            console.log("Firebase anonymous sign-in skipped (restricted operation). Fallback to local storage mode is active.");
          }
        }

        const { getCurrentUser, updateUser, registerUser } = localDb;
        let currentUser = getCurrentUser();
        
        if (currentUser) {
          // If the local user ID is different from the Firebase UID, migrate the local user's data to use the Firebase UID
          // This keeps local ID in sync with Firebase UID, satisfying security rules!
          if (firebaseUser && currentUser.id !== firebaseUser.uid) {
            console.log(`Migrating local user ID from ${currentUser.id} to Firebase UID ${firebaseUser.uid}`);
            localDb.migrateUserId(currentUser.id, firebaseUser.uid);
            currentUser = getCurrentUser();
          }
        } else if (firebaseUser) {
          // Auto-register a default local user using the Firebase UID to make onboarding frictionless
          const isOwner = firebaseUser.email?.toLowerCase() === 'nhuochy259@gmail.com';
          const defaultEmail = isOwner ? 'nhuochy259@gmail.com' : `user_${firebaseUser.uid.substring(0, 5)}@tgnhapvai.com`;
          const regRes = registerUser(
            defaultEmail,
            '123456',
            `User_${firebaseUser.uid.substring(0, 5)}`,
            isOwner ? 'ADMIN' : 'USER',
            isOwner ? true : false,
            firebaseUser.uid
          );
          currentUser = regRes.user;
          console.log("Auto-registered frictionless local user:", currentUser);
        }

        if (currentUser) {
          // Ensure user immediate settings are applied
          if (currentUser.themePreference) {
            applyTheme(currentUser.themePreference);
          }
          
          // Auto-upgrade nhuochy259@gmail.com to ADMIN
          const isOwner = currentUser.email?.toLowerCase() === 'nhuochy259@gmail.com';
          if (isOwner && (currentUser.role !== 'ADMIN' || !currentUser.creatorStatus)) {
            updateUser(currentUser.id, { role: 'ADMIN', creatorStatus: true });
            const updatedUser = getCurrentUser();
            setAuth({ uid: updatedUser.id, email: updatedUser.email, displayName: updatedUser.displayName, photoURL: updatedUser.avatar }, updatedUser);
          } else {
            setAuth({ uid: currentUser.id, email: currentUser.email, displayName: currentUser.displayName, photoURL: currentUser.avatar }, currentUser);
          }
        } else {
          setAuth(null, null);
        }
      } catch (e) {
        console.log("Notice: Local DB/Firebase auth initialization failed:", e);
        setAuth(null, null);
      } finally {
        setInitialized(true);
      }
    };

    initAuth();
  }, [setAuth, setInitialized]);

  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/welcome" element={<Welcome />} />
        
        <Route path="/create-character" element={<ProtectedRoute><CreateCharacter /></ProtectedRoute>} />
        <Route path="/edit-character/:id" element={<ProtectedRoute><CreateCharacter /></ProtectedRoute>} />
        
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/ai-search" element={<AISearch />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/feedbacks" element={<Feedbacks />} />
          <Route path="/feedback" element={<Feedbacks />} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/creator/dashboard" element={<ProtectedRoute><CreatorDashboard /></ProtectedRoute>} />
          <Route path="/creator/:id" element={<CreatorDetail />} />
          <Route path="/character/:id" element={<CharacterDetail />} />
          <Route path="/prompt/:id" element={<PromptDetail />} />
          <Route path="/admin" element={<ProtectedRoute><DashboardStats /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><DashboardStats /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute><ReportQueue /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          <Route path="/admin/badges" element={<ProtectedRoute><BadgeManager /></ProtectedRoute>} />
          <Route path="/admin/support" element={<ProtectedRoute><SupportManager /></ProtectedRoute>} />
          <Route path="/admin/managers" element={<ProtectedRoute><AdminModeratorManager /></ProtectedRoute>} />
          <Route path="/admin/creators" element={<ProtectedRoute><CreatorManager /></ProtectedRoute>} />
          <Route path="/admin/content" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          {/* Add more routes later */}
          <Route path="*" element={<div className="p-8 text-center">404 - Not Found</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

