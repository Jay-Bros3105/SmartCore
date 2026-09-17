/**
 * Push notifications — app ya msimamizi (Expo).
 *
 * Inatumia **FCM token ya kifaa** (getDevicePushTokenAsync) — sio Expo push —
 * ili Cloud Functions (firebase-admin/FCM) iweze kutumia token hiyo moja kwa
 * moja pamoja na zile za admin web.
 *
 * Android inahitaji `android/app/google-services.json` (kutoka Firebase
 * console → Project settings → Android app com.jslfastline.neosmartcore) na
 * google-services plugin kwenye gradle. Bila hiyo, upatanifu wa kutuma haufanyi
 * kazi lakini app inaendelea (tatizo linakamatwa kwa utulivu).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { getDB } from './firebase';

export const DEVICE_TOKENS_COLLECTION = 'deviceTokens';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Omba ruhusa + tafuta FCM token ya kifaa hiki. Token inahifadhiwa kwenye
 * `deviceTokens/{userId}` kwa jina la watumiaji wote (admin + managers).
 * Usalama: inaitwa mara moja kwenye HomeScreen baada ya manager kupakiwa.
 */
export async function initPushNotifications(userId?: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    if (!userId) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Neo-SmartCore',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2BB6C9',
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (!permission.granted) return;

    const fcmToken = await getFcmToken();
    if (!fcmToken) return;

    await setDoc(
      doc(getDB(), DEVICE_TOKENS_COLLECTION, userId),
      { tokens: arrayUnion(fcmToken) },
      { merge: true }
    );
  } catch (err) {
    // Bila google-services.json / FCM haipatikani — usivunje app.
    if (__DEV__) {
      console.warn('Notifications not available:', err instanceof Error ? err.message : err);
    }
  }
}

/** FCM token asili ya Android (inatumika na firebase-admin FCM katika functions). */
async function getFcmToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const device = await Notifications.getDevicePushTokenAsync();
    if (!device || !device.data) return null;
    const raw = typeof device.data === 'string' ? device.data : (device.data as { token?: string }).token;
    return raw && raw.length > 8 ? raw : null;
  } catch {
    return null;
  }
}