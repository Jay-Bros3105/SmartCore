/**
 * MIPANGILIO YA FIREBASE — ADMIN WEB
 * Weka API credentials zako hapa (hizo hizo zile kama za app).
 *
 * Njia:
 * 1. Firebase Console → Project Settings → General → "Your apps" → Web app
 * 2. Nakili firebaseConfig.
 * 3. Weka chini, badilisha USE_FIREBASE kuwa `true`.
 *
 * Wakati USE_FIREBASE=false, dashboard hutumia mock data kutoka './data'.
 */
'use client';

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  deleteDoc,
  getDoc,
  setDoc,
  onSnapshot,
  where,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

export const USE_FIREBASE = true;

export const firebaseConfig = {
  apiKey: 'AIzaSyBkxk_5m5J_nuDHwRl4lQwZO_n_KKkaPRQ',
  authDomain: 'smartcore-6673d.firebaseapp.com',
  projectId: 'smartcore-6673d',
  storageBucket: 'smartcore-6673d.firebasestorage.app',
  messagingSenderId: '123226096302',
  appId: '1:123226096302:web:394ef7d0a9d3ac534e233f',
};

let app: ReturnType<typeof initializeApp> | null = null;

function getApp() {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function isFirebaseConfigured(): boolean {
  return USE_FIREBASE && firebaseConfig.apiKey.length > 0;
}

export const COLLECTIONS = {
  branches: 'branches',
  users: 'users',
  pendingRegistrations: 'pendingRegistrations',
  products: 'products',
  transactions: 'transactions',
  closingReports: 'closingReports',
  openingStocks: 'openingStocks',
  currentStocks: 'currentStocks',
  cashReconciliations: 'cashReconciliations',
  stockReceiving: 'stockReceiving',
  stockRequests: 'stockRequests',
  expenses: 'expenses',
} as const;

/** Auth: kuingia kwa msimamizi (email + password). */
export async function adminLogin(email: string, password: string) {
  const auth = getAuth(getApp());
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function adminLogout() {
  const auth = getAuth(getApp());
  await signOut(auth);
}

/** Badilisha password ya mtumiazi aliyeingia (re-auth with current password, then update). */
export async function changeAdminPassword(currentPassword: string, newPassword: string) {
  const auth = getAuth(getApp());
  const user = auth.currentUser;
  if (!user) throw new Error('NO_AUTH_USER');
  const credential = EmailAuthProvider.credential(user.email ?? '', currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/** Thibitisha kwamba mtu yupo logged in kwenye Firebase Auth.
 *  Tahadhari: session inarejeshwa kwa wakati (async) — hivyo tuna-subscribe
 *  onAuthStateChanged kusubiri hadi hali ya auth ijulikane, badala ya
 *  kusoma `auth.currentUser` mara moja (ambao unaweza kuwa null mapema,
 *  na kumrudisha mtu kwenye login bila sababu). */
export async function requireAdmin(): Promise<{ email: string | null; uid: string } | null> {
  const auth = getAuth(getApp());
  const state = await new Promise<{
    email: string | null;
    uid: string;
  } | null>((resolve) => {
    const current = auth.currentUser;
    if (current) {
      resolve({ email: current.email, uid: current.uid });
      return;
    }
    // Subiri moja (au timeout 4s) — ikiwa hakuna kikao, toa null.
    let unsub: () => void = () => {};
    const timer = setTimeout(() => {
      unsub();
      resolve(null);
    }, 4000);
    unsub = onAuthStateChanged(auth, (u) => {
      clearTimeout(timer);
      unsub();
      if (u) resolve({ email: u.email, uid: u.uid });
      else resolve(null);
    });
  });
  if (!state) return null;
  const u = auth.currentUser;
  if (u) await u.getIdToken().catch(() => {}); // pokeze token yoyote iliyofifia
  return { email: state.email, uid: state.uid };
}

/** Helpers za Firestore — ziko ready kutumika mara credentials zitakapowekwa. */
export {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  deleteDoc,
  getDoc,
  setDoc,
  onSnapshot,
};
export function getAdminDb() {
  return getFirestore(getApp());
}
export function getAdminStorage() {
  return getStorage(getApp());
}

export default {
  firebaseConfig,
  USE_FIREBASE,
  isFirebaseConfigured,
  COLLECTIONS,
};