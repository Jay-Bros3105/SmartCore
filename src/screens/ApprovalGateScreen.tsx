import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import {
  clearManagerProfile,
  subscribeRegistrationStatus,
} from '../services/storeService';
import type { ManagerProfile, RegistrationStatus } from '../services/types';

type Status = RegistrationStatus | 'missing' | 'loading';

type Props = {
  profile: ManagerProfile;
  onApproved: () => void;
  onReset: () => void;
};

export default function ApprovalGateScreen({ profile, onApproved, onReset }: Props) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const unsub = subscribeRegistrationStatus(
      profile.userId,
      (s) => {
        if (s === null) setStatus('missing');
        else setStatus(s);
      },
      () => setStatus('pending')
    );
    return unsub;
  }, [profile.userId]);

  useEffect(() => {
    if (status === 'approved') {
      const to = setTimeout(onApproved, 400);
      return () => clearTimeout(to);
    }
    return undefined;
  }, [status, onApproved]);

  const reset = async () => {
    await clearManagerProfile();
    onReset();
  };

  const isPending = status === 'loading' || status === 'pending';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Image
            source={require('../../assets/logo-transparent.png')}
            style={[styles.logo, { tintColor: colors.logoBlue }]}
            resizeMode="contain"
          />

          {isPending && (
            <>
              <ActivityIndicator
                color={colors.logoBlue}
                style={{ marginBottom: spacing.md }}
              />
              <Text style={[styles.title, { color: colors.text }]}>
                Your registration is waiting for admin approval
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                We received your details for {profile.fullName} at{' '}
                {profile.branchName}. As soon as your Admin approves, this app
                will open automatically right here.
              </Text>
            </>
          )}

          {status === 'missing' && (
            <>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.danger}1A` }]}>
                <Ionicons name="alert-circle" size={30} color={colors.danger} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Registration not found
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Your registration is no longer in the system. Please register
                again from scratch.
              </Text>
            </>
          )}

          {status === 'rejected' && (
            <>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.danger}1A` }]}>
                <Ionicons name="close-circle" size={30} color={colors.danger} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Your registration was not approved
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Your Admin has marked this registration as &quot;rejected&quot;.
                Contact your system administrator, or register again with the
                correct details.
              </Text>
            </>
          )}
        </View>

        {(status === 'rejected' || status === 'missing') && (
          <Pressable
            onPress={reset}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: colors.logoBlue,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={[styles.buttonText, { color: colors.onBrand }]}>
              Start Registration Again
            </Text>
          </Pressable>
        )}

        {isPending && (
          <View style={styles.pendingNote}>
            <Ionicons name="time" size={14} color={colors.textMuted} />
            <Text style={[styles.pendingText, { color: colors.textMuted }]}>
              Sit back — the app is watching live. No need to tap anything.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 84,
    height: 84,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 330,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
  },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  pendingText: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
});