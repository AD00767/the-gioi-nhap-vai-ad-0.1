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

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      try {
        if (firebaseUser) {
          const { getUserById, registerUser, updateUser } = localDb;
          let currentUser = getUserById(firebaseUser.uid);
          
          if (!currentUser) {
            const isOwner = firebaseUser.email?.toLowerCase() === 'nhuochy259@gmail.com';
            const defaultEmail = firebaseUser.email || `user_${firebaseUser.uid.substring(0, 5)}@tgnhapvai.com`;
            const regRes = registerUser(
              defaultEmail,
              undefined,
              firebaseUser.displayName || `User_${firebaseUser.uid.substring(0, 5)}`,
              isOwner ? 'ADMIN' : 'USER',
              isOwner ? true : false,
              firebaseUser.uid
            );
            currentUser = regRes.user;
          }

          if (currentUser) {
            if (currentUser.themePreference) {
              applyTheme(currentUser.themePreference);
            }
            
            const isOwner = currentUser.email?.toLowerCase() === 'nhuochy259@gmail.com';
            if (isOwner && (currentUser.role !== 'ADMIN' || !currentUser.creatorStatus)) {
              updateUser(currentUser.id, { role: 'ADMIN', creatorStatus: true });
              const updatedUser = getUserById(currentUser.id);
              setAuth(firebaseUser, updatedUser);
            } else {
              setAuth(firebaseUser, currentUser);
            }
          } else {
            setAuth(null, null);
          }
        } else {
          setAuth(null, null);
        }
      } catch (err) {
        console.error("Notice: Local DB/Firebase auth state sync error:", err);
        setAuth(null, null);
      } finally {
        setInitialized(true);
      }
    });

    return () => unsubscribe();
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

