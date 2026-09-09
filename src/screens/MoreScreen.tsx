import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import StatusPill from '../components/StatusPill';
import PinPad from '../components/PinPad';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import {
  clearManagerProfile,
  getCurrentManager,
} from '../services/storeService';
import { isAppLockEnabled, setAppLockEnabled } from '../services/appLockService';
import type { ManagerProfile } from '../services/types';
import type { MainTabParamList } from '../navigation/TabNavigator';

type Props = BottomTabScreenProps<MainTabParamList, 'More'>;

export default function MoreScreen({ navigation }: Props) {
  const { colors, isDark, toggleMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockModal, setLockModal] = useState(false);
  const [lockModalMode, setLockModalMode] = useState<'set' | 'change'>('set');
  const [pinStep, setPinStep] = useState<1 | 2>(1);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [lockError, setLockError] = useState('');
  const [savingLock, setSavingLock] = useState(false);

  useEffect(() => {
    getCurrentManager().then(setManager).catch(() => {});
    isAppLockEnabled().then(setLockEnabled).catch(() => {});
  }, []);

  const openLockModal = (mode: 'set' | 'change' = 'set') => {
    setLockModalMode(mode);
    setNewPin('');
    setConfirmPin('');
    setPinStep(1);
    setLockError('');
    setLockModal(true);
  };

  const closeLockModal = () => {
    if (savingLock) return;
    setLockModal(false);
    setNewPin('');
    setConfirmPin('');
    setPinStep(1);
    setLockError('');
  };

  const finishEnable = async (pin: string) => {
    setSavingLock(true);
    try {
      await setAppLockEnabled(true, pin);
      setLockEnabled(true);
      setLockModal(false);
      setNewPin('');
      setConfirmPin('');
      setPinStep(1);
      setLockError('');
    } finally {
      setSavingLock(false);
    }
  };

  const handleLockToggle = (next: boolean) => {
    if (next) {
      openLockModal('set');
    } else {
      setAppLockEnabled(false)
        .then(() => setLockEnabled(false))
        .catch(() => {});
    }
  };

  const handleNewPinInput = (v: string) => {
    setLockError('');
    if (pinStep === 1) {
      setNewPin(v);
      if (v.length === 4) setPinStep(2);
    } else {
      setConfirmPin(v);
      if (v.length === 4) {
        if (v === newPin) {
          finishEnable(v);
        } else {
          setLockError('PINs do not match. Try again.');
          setNewPin('');
          setConfirmPin('');
          setPinStep(1);
        }
      }
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Change Shop / Reset',
      'You will be re-registered (name, phone and shop). Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            await clearManagerProfile();
            navigation.getParent()?.navigate('Onboarding' as never);
          },
        },
      ]
    );
  };

  const initials = (manager?.fullName ?? 'NS')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.heading}>
          <View style={styles.headingRow}>
            <Image
              source={require('../../assets/logo-transparent.png')}
              style={[styles.logo, { tintColor: colors.logoBlue }]}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: colors.text }]}>More</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + 74 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile card */}
          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.bg, shadowColor: colors.shadow },
            ]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.logoBlue }]}>
              <Text style={[styles.avatarText, { color: colors.white }]}>
                {initials}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {manager?.fullName ?? 'Manager'}
              </Text>
              <View style={styles.profileMeta}>
                <Ionicons name="storefront-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.profileMetaText, { color: colors.textMuted }]}>
                  {manager?.branchName ?? 'No shop'}
                </Text>
              </View>
              <View style={styles.profileMeta}>
                <Ionicons name="call-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.profileMetaText, { color: colors.textMuted }]}>
                  {manager?.phone ?? '-'}
                </Text>
              </View>
            </View>
            <StatusPill
              tone={manager?.status === 'approved' ? 'ok' : 'warning'}
              label={manager?.status === 'approved' ? 'Approved' : 'Waiting'}
            />
          </View>

          {/* Settings */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
          <View
            style={[
              styles.settingsCard,
              { backgroundColor: colors.bg, shadowColor: colors.shadow },
            ]}
          >
            <View style={styles.settingsRow}>
              <View style={styles.settingsLabel}>
                <Ionicons
                  name={isDark ? 'moon' : 'sunny'}
                  size={18}
                  color={colors.logoBlue}
                />
                <Text style={[styles.settingsText, { color: colors.text }]}>
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleMode}
                trackColor={{ false: colors.border, true: colors.logoBlue }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.settingsRow}>
              <View style={styles.settingsLabel}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={colors.logoBlue}
                />
                <View>
                  <Text style={[styles.settingsText, { color: colors.text }]}>
                    App Lock
                  </Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.textMuted }}>
                    {lockEnabled ? '4-digit PIN required to open' : 'Optional privacy PIN'}
                  </Text>
                </View>
              </View>
              <Switch
                value={lockEnabled}
                onValueChange={handleLockToggle}
                trackColor={{ false: colors.border, true: colors.logoBlue }}
                thumbColor={colors.white}
                disabled={savingLock}
              />
            </View>

            {lockEnabled && (
              <Pressable
                onPress={() => openLockModal('change')}
                style={({ pressed }) => [
                  styles.settingsRow,
                  styles.settingsRowBorder,
                  { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={styles.settingsLabel}>
                  <Ionicons
                    name="keypad-outline"
                    size={18}
                    color={colors.logoBlue}
                  />
                  <Text style={[styles.settingsText, { color: colors.text }]}>
                    Change PIN
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.border} />
              </Pressable>
            )}

            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.settingsRow,
                styles.settingsRowBorder,
                { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.settingsLabel}>
                <Ionicons
                  name="storefront-outline"
                  size={18}
                  color={colors.logoBlue}
                />
<Text style={[styles.settingsText, { color: colors.text }]}>
                    Change Shop / Reset
                  </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>
          </View>

          <View style={styles.footerBrand}>
            <Image
              source={require('../../assets/logo-transparent.png')}
              style={[styles.footerLogo, { tintColor: colors.logoBlue }]}
              resizeMode="contain"
            />
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              Neo SmartCore · JSL FastLine Technologies
            </Text>
            <Text style={[styles.footerVersion, { color: colors.textMuted }]}>
              Version 1.0.0 · SDK 57
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={lockModal}
        transparent
        animationType="slide"
        onRequestClose={closeLockModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(16,32,46,0.55)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="lock-closed" size={20} color={colors.logoBlue} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {lockModalMode === 'change' ? 'Change App Lock PIN' : 'Set App Lock PIN'}
              </Text>
              <Pressable onPress={closeLockModal} style={styles.modalClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.modalHint, { color: colors.textMuted }]}>
              {lockModalMode === 'change'
                ? pinStep === 1
                  ? 'Enter a new 4-digit PIN'
                  : 'Confirm your new PIN'
                : pinStep === 1
                ? 'Enter a 4-digit PIN'
                : 'Confirm your 4-digit PIN'}
            </Text>
            {lockError ? (
              <View style={[styles.lockErrorBox, { backgroundColor: 'rgba(198,40,40,0.12)' }]}>
                <Text style={[styles.lockErrorText, { color: colors.danger }]}>{lockError}</Text>
              </View>
            ) : null}
            <PinPad
              value={pinStep === 1 ? newPin : confirmPin}
              onChange={handleNewPinInput}
              maxLength={4}
            />
            <Pressable
              onPress={closeLockModal}
              style={({ pressed }) => [styles.modalCancel, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 30,
    height: 30,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
  },
  profileName: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  profileMetaText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  settingsCard: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  settingsRowBorder: {
    borderTopWidth: 1,
  },
  settingsLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  footerBrand: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: 3,
  },
  footerLogo: {
    width: 28,
    height: 28,
    opacity: 0.6,
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  footerVersion: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
    maxWidth: 380,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    flex: 1,
  },
  modalClose: {
    padding: 2,
  },
  modalHint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  lockErrorBox: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  lockErrorText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    textAlign: 'center',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  modalCancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
});