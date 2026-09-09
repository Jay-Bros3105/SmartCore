/**
 * MIPANGILIO YA FIREBASE — weka API credentials yako hapa.
 *
 * Jinsi ya kupata hizi:
 * 1. Firebase Console → Project Settings → General → "Your apps" → Web app (</>)
 * 2. Nakili firebaseConfig (apiKey, authDomain, projectId, storageBucket,
 *    messagingSenderId, appId)
 * 3. Weka chini, kisha badilisha USE_FIREBASE kuwa `true`.
 *
 * WAKATI USE_FIREBASE=false: app inatumia data ya mfano (mock) iliyoko kwenye
 * kifaa — inaweza kufanya kazi kabisa kwenye Expo Go.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

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

/** Majina ya Firestore collections — yanapaswa kufanana kati ya app na admin web. */
export const COLLECTIONS = {
  branches: 'branches',
  users: 'users',
  admins: 'admins',
  pendingRegistrations: 'pendingRegistrations',
  products: 'products',
  transactions: 'transactions',
  openingStocks: 'openingStocks',
  currentStocks: 'currentStocks',
  closingReports: 'closingReports',
  cashReconciliations: 'cashReconciliations',
  stockReceiving: 'stockReceiving',
  stockRequests: 'stockRequests',
  expenses: 'expenses',
} as const;

export function getDB() {
  return getFirestore(getApp());
}

export function getAuthApp() {
  return getAuth(getApp());
}

export function getStorageApp() {
  return getStorage(getApp());
}

export default { firebaseConfig, USE_FIREBASE, isFirebaseConfigured, getDB, getAuthApp };