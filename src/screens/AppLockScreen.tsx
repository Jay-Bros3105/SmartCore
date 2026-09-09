import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import PinPad from '../components/PinPad';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import {
  SECURITY_QUESTIONS,
  checkSecurityAnswer,
  resetAppPin,
  verifyAppPin,
  type SecurityQuestion,
} from '../services/appLockService';

type Mode = 'pin' | 'forgot-select' | 'forgot-answer' | 'reset';

type Props = {
  onUnlock: () => void;
};

export default function AppLockScreen({ onUnlock }: Props) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState<SecurityQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'pin' || pin.length < 4) return;
    let active = true;
    verifyAppPin(pin).then((ok) => {
      if (!active) return;
      if (ok) onUnlock();
      else {
        setError('Incorrect PIN. Try again.');
        setPin('');
      }
    });
    return () => {
      active = false;
    };
  }, [pin, mode, onUnlock]);

  const pickQuestion = (q: SecurityQuestion) => {
    setQuestion(q);
    setAnswer('');
    setError('');
    setMode('forgot-answer');
  };

  const submitAnswer = () => {
    if (!question) return;
    if (!answer.trim()) {
      setError('Enter your answer.');
      return;
    }
    if (checkSecurityAnswer(question.id, answer)) {
      setError('');
      setMode('reset');
      setNewPin('');
      setConfirmPin('');
    } else {
      setError('Wrong answer. Please try again.');
      setAnswer('');
    }
  };

  useEffect(() => {
    if (mode !== 'reset' || saving) return;
    if (newPin.length < 4 || confirmPin.length < 4) return;
    if (newPin === confirmPin) {
      setSaving(true);
      resetAppPin(newPin)
        .then(() => {
          setPin('');
          onUnlock();
        })
        .catch(() => setError('Could not save new PIN. Try again.'))
        .finally(() => setSaving(false));
    } else {
      setError('PINs do not match.');
      setNewPin('');
      setConfirmPin('');
    }
  }, [newPin, confirmPin, mode, saving, onUnlock]);

  const subtitle =
    mode === 'pin'
      ? 'Enter your 4-digit PIN'
      : mode === 'forgot-select'
      ? 'Choose a security question'
      : mode === 'forgot-answer'
      ? question?.question ?? ''
      : 'Set a new 4-digit PIN';

  return (
    <LinearGradient
      colors={[colors.headerTop, colors.headerBottom]}
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={34} color={colors.onHeader} />
            </View>
            <Text style={[styles.title, { color: colors.onHeader }]}>
              {mode === 'reset' ? 'Reset App Lock PIN' : 'App Lock'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.onHeader }]}>
              {subtitle}
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(198,40,40,0.25)' }]}>
                <Text style={[styles.errorText, { color: colors.onHeader }]}>{error}</Text>
              </View>
            ) : null}

            {mode === 'pin' && (
              <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
                <PinPad value={pin} onChange={(v) => { setPin(v); setError(''); }} maxLength={4} error={!!error} />
                <Pressable
                  onPress={() => setMode('forgot-select')}
                  style={({ pressed }) => [styles.forgotBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.forgotText, { color: colors.logoBlue }]}>Forgot PIN?</Text>
                </Pressable>
              </View>
            )}

            {mode === 'forgot-select' && (
              <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
                {SECURITY_QUESTIONS.map((q) => (
                  <Pressable
                    key={q.id}
                    onPress={() => pickQuestion(q)}
                    style={({ pressed }) => [
                      styles.qOption,
                      { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.qText, { color: colors.text }]}>{q.question}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => { setMode('pin'); setError(''); }}
                  style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="arrow-back" size={15} color={colors.logoBlue} />
                  <Text style={[styles.backText, { color: colors.logoBlue }]}>Back to PIN</Text>
                </Pressable>
              </View>
            )}

            {mode === 'forgot-answer' && (
              <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
                <Text style={[styles.answerLabel, { color: colors.textMuted }]}>Your answer</Text>
                <TextInput
                  style={[styles.answerInput, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  value={answer}
                  onChangeText={(v) => { setAnswer(v); setError(''); }}
                  autoCorrect={false}
                  autoCapitalize="none"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={submitAnswer}
                />
                <Pressable
                  onPress={submitAnswer}
                  style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.logoBlue, opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={[styles.submitText, { color: colors.onBrand }]}>Verify Answer</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setMode('forgot-select'); setQuestion(null); setAnswer(''); setError(''); }}
                  style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="arrow-back" size={15} color={colors.logoBlue} />
                  <Text style={[styles.backText, { color: colors.logoBlue }]}>Choose another question</Text>
                </Pressable>
              </View>
            )}

            {mode === 'reset' && (
              <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
                <Text style={[styles.answerLabel, { color: colors.textMuted }]}>New PIN</Text>
                <PinPad value={newPin} onChange={(v) => { setNewPin(v); setError(''); }} maxLength={4} error={!!error && newPin.length === 4} />
                <Text style={[styles.answerLabel, { color: colors.textMuted, marginTop: spacing.md }]}>Confirm new PIN</Text>
                <PinPad value={confirmPin} onChange={(v) => { setConfirmPin(v); setError(''); }} maxLength={4} error={!!error && confirmPin.length === 4} />
                <Pressable
                  onPress={() => { setError(''); setNewPin(''); setConfirmPin(''); }}
                  style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Ionicons name="refresh" size={15} color={colors.logoBlue} />
                  <Text style={[styles.backText, { color: colors.logoBlue }]}>Start over</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  lockBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
  },
  subtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    opacity: 0.92,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  errorBox: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    maxWidth: 320,
    width: '100%',
  },
  errorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    paddingTop: spacing.lg,
    width: '100%',
    maxWidth: 360,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  forgotBtn: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  forgotText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  qOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  qText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    flex: 1,
    paddingRight: spacing.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  answerLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  answerInput: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  submitBtn: {
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  submitText: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
  },
});