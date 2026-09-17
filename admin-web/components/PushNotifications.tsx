'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { getFirestore, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { isFirebaseConfigured, FIREBASE_VAPID_KEY, getAdminApp, firebaseConfig } from '../lib/firebase';

const SW_URL = '/firebase-messaging-sw.js';

/**
 * Usajili wa push notifications (Web) kwa admin dashboard:
 * 1) Anaruhusu notification,
 * 2) Anapata FCM token kwenye service worker ya firebase,
 * 3) Token inahifadhiwa kwenye `deviceTokens/{adminUid}` — Cloud Functions
 *    huitumia kutuma "Pending Approval From Shop X", "Insufficient Products",
 *    n.k. Manager app inapokea "Admin's Approval Success".
 */
function useAdminPush() {
  const [askBanner, setAskBanner] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);
  const initRef = useRef(false);

  async function saveToken(uid: string) {
    if (!uid) return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') {
      setAskBanner(true);
      return;
    }
    setRegistering(true);
    try {
      const supported = await isSupported();
      if (!supported) {
        setRegistering(false);
        return;
      }
      const app = getAdminApp();
      const reg = await navigator.serviceWorker.register(SW_URL);
      await navigator.serviceWorker.ready;
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: reg,
      });
      if (token) {
        await setDoc(
          doc(getFirestore(app), 'deviceTokens', uid),
          { tokens: arrayUnion(token) },
          { merge: true }
        );
        setDone(true);
        setAskBanner(false);
      }
      onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'Neo-SmartCore';
        const body = payload.notification?.body || (payload.data?.body as string) || '';
        try {
          new Notification(title, { body, icon: '/NeoSmartCore_Icon.png', badge: '/NeoSmartCore_Icon.png' });
        } catch {
          /* Sapphire Prev — tusiingie kwenye UI. */
        }
      });
    } catch {
      setAskBanner(true);
    } finally {
      setRegistering(false);
    }
  }

  async function requestPermission(uid: string) {
    if (!uid) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setAskBanner(false);
        await saveToken(uid);
      }
    } catch {
      setAskBanner(false);
    }
  }

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (typeof window === 'undefined') return;
    if (typeof Notification === 'undefined') return;
    if (!isFirebaseConfigured() || !FIREBASE_VAPID_KEY) return;
    let disposed = false;
    isSupported()
      .then((supported) => {
        if (disposed || !supported) return;
        const auth = getAuth(getAdminApp());
        const unsub = auth.onAuthStateChanged((user) => {
          if (disposed) return;
          if (!user) return;
          // Ruhusa isipokuwa imeshakubaliwa → onyesha banner na button ya "Ruhusu".
          if (Notification.permission === 'granted') {
            saveToken(user.uid);
          } else {
            setAskBanner(true);
          }
        });
        if (disposed) unsub();
        return () => {};
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { askBanner, registering, done, currentUid: () => getAuth(getAdminApp()).currentUser?.uid, requestPermission, dismiss: () => setAskBanner(false) };
}

export default function PushNotifications() {
  const { askBanner, registering, done, requestPermission, dismiss } = useAdminPush();

  if (!askBanner) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 84,
        right: 20,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,.25)',
        padding: '10px 14px',
        maxWidth: 320,
      }}
    >
      {registering ? <Bell size={18} /> : <BellRing size={18} style={{ color: 'var(--primary)' }} />}
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>
        <b>Taarifa za SmartCore</b>
        <br />
        Wezesha notifications — utapokea maombi ya maduka na maonyo ya stock moja kwa moja.
      </div>
      {registering ? (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Inaandika…</span>
      ) : (
        <button
          onClick={() => {
            const uid = getAuth(getAdminApp()).currentUser?.uid;
            if (uid) requestPermission(uid);
          }}
          style={{
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            padding: '7px 14px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {done ? 'Wezesha' : 'Ruhusu'}
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Funga"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}