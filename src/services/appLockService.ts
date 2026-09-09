import AsyncStorage from '@react-native-async-storage/async-storage';
import sha256 from '../utils/sha256';

const ENABLED_KEY = 'neo_applock_enabled';
const PIN_KEY = 'neo_applock_pin_hash';

export type SecurityQuestion = {
  id: 'brand' | 'phone' | 'master';
  question: string;
  answer: string;
};

export const SECURITY_QUESTIONS: SecurityQuestion[] = [
  { id: 'brand', question: 'What Is My Brand?', answer: 'JSL FastLine' },
  { id: 'phone', question: "What's My Phone Number?", answer: '0718573799' },
  { id: 'master', question: 'Master PIN?', answer: '3105' },
];

export async function isAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean, pin?: string): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  if (enabled && pin && pin.length >= 4) {
    await AsyncStorage.setItem(PIN_KEY, sha256(pin));
  }
}

export async function verifyAppPin(pin: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(PIN_KEY);
  if (!stored) return true;
  return sha256(pin) === stored;
}

export async function resetAppPin(newPin: string): Promise<void> {
  await AsyncStorage.setItem(PIN_KEY, sha256(newPin));
}

export function checkSecurityAnswer(id: SecurityQuestion['id'], answer: string): boolean {
  const q = SECURITY_QUESTIONS.find((x) => x.id === id);
  if (!q) return false;
  return q.answer.trim().toLowerCase() === answer.trim().toLowerCase();
}