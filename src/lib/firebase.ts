import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Google Sign-In with popup
 */
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return { user: result.user };
};

export const logout = async () => {
  await signOut(auth);
};

