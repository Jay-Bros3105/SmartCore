import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import {
  subscribeAdmins,
  subscribeBranches,
  registerManager,
} from '../services/storeService';
import { regionLabel } from '../data/regions';
import type { AdminInfo, Branch, ManagerProfile } from '../services/types';

type Props = {
  onComplete: (profile: ManagerProfile) => void;
};

type Step = 0 | 1 | 2 | 3;

const SCREEN_W = Dimensions.get('window').width;

/** Field inayofungamanishwa na dropdown (placeholder → tap → list upitie). */
function SelectField({
  placeholder,
  value,
  onPress,
  colors,
  disabled,
}: {
  placeholder: string;
  value: string | null;
  onPress: () => void;
  colors: {
    bg: string;
    border: string;
    text: string;
    textMuted: string;
    logoBlue: string;
  };
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[
        styles.selectField,
        { backgroundColor: colors.bg, borderColor: colors.border },
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          styles.selectFieldText,
          { color: value ? colors.text : colors.textMuted },
        ]}
        numberOfLines={1}
      >
        {value ?? placeholder}
      </Text>
      <View style={styles.selectChevronWrap}>
        <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

/** Modal ya orodha (Admins / Shops) — mwenendo wa "tumia dropdown". */
function ListModal({
  visible,
  title,
  placeholder,
  items,
  selectedKey,
  loading,
  emptyText,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  items: { key: string; label: string; trailing?: string }[];
  selectedKey: string | null;
  loading: boolean;
  emptyText: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalGrabber} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>{placeholder}</Text>

          {loading ? (
            <ActivityIndicator color={colors.logoBlue} style={{ marginVertical: spacing.xl }} />
          ) : items.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Ionicons name="storefront-outline" size={34} color={colors.textMuted} />
              <Text style={[styles.modalEmptyText, { color: colors.textMuted }]}>{emptyText}</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {items.map((it) => {
                const active = it.key === selectedKey;
                return (
                  <Pressable
                    key={it.key}
                    onPress={() => onSelect(it.key)}
                    style={[
                      styles.modalRow,
                      { borderColor: active ? colors.logoBlue : colors.border },
                      active && { backgroundColor: `${colors.logoBlue}14` },
                    ]}
                  >
                    <View style={styles.modalRowMain}>
                      <Text style={[styles.modalRowLabel, { color: colors.text }]}>
                        {it.label}
                      </Text>
                      {it.trailing ? (
                        <Text style={[styles.modalRowTrailing, { color: colors.textMuted }]}>
                          {it.trailing}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={active ? colors.logoBlue : colors.border}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>(0);
  const slide = useRef(new Animated.Value(0)).current;

  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminInfo | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<Branch | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);
  const [adminModal, setAdminModal] = useState(false);
  const [shopModal, setShopModal] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ManagerProfile | null>(null);

  useEffect(() => {
    setLoadingAdmins(true);
    const unsub = subscribeAdmins(
      (list) => {
        setAdmins(list);
        setLoadingAdmins(false);
      },
      () => {
        setAdmins([]);
        setLoadingAdmins(false);
      }
    );
    return unsub;
  }, []);

  const ownerUid = selectedAdmin?.uid;

  useEffect(() => {
    if (!ownerUid) return;
    setLoadingStores(true);
    setSelected(null);
    const unsub = subscribeBranches(
      ownerUid,
      (list) => {
        setBranches(list);
        setLoadingStores(false);
        setSelected((prev) => (prev && list.some((b) => b.id === prev.id) ? prev : null));
      },
      () => {
        setBranches([]);
        setLoadingStores(false);
      }
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerUid]);

  const adminItems = useMemo(
    () =>
      admins.map((a, idx) => ({
        key: a.uid,
        label: `Admin ${idx + 1} · ${a.name}`,
        trailing: a.email || undefined,
      })),
    [admins]
  );

  const shopItems = useMemo(
    () =>
      branches.map((b) => ({
        key: b.id,
        label: b.name,
        trailing: regionLabel(b.region),
      })),
    [branches]
  );

  const detailsValid =
    fullName.trim().length >= 3 && /^\+?[0-9\s-]{9,15}$/.test(phone.trim());

  const goTo = (next: Step) => {
    Animated.timing(slide, {
      toValue: -next * SCREEN_W,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setStep(next));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    const result = await registerManager({
      fullName,
      phone,
      branch: selected as Branch,
      adminUid: selectedAdmin?.uid ?? selected?.ownerUid,
    });
    setSubmitting(false);
    if (result.ok) {
      setProfile(result.profile);
      goTo(3);
    } else {
      setError(result.message);
    }
  };

  const primaryText = colors.onBrand ?? colors.white;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo-transparent.png')}
            style={[styles.headerLogo, { tintColor: colors.logoBlue }]}
            resizeMode="contain"
          />
          {step === 1 || step === 2 ? (
            <Pressable
              onPress={() => goTo((step - 1) as Step)}
              hitSlop={12}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}

          <View style={styles.headerCenter}>
            <Text style={[styles.brandName, { color: colors.text }]}>Neo SmartCore</Text>
            <Text style={[styles.brandSub, { color: colors.textMuted }]}>
              Manage your shop
            </Text>
          </View>

          <View style={styles.stepsWrap}>
            {([0, 1, 2] as Step[]).map((s) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      step === s ? colors.logoBlue : step > s ? colors.logoBlue : colors.border,
                    opacity: step === s ? 1 : step > s ? 0.5 : 1,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Sliding steps */}
        <Animated.View
          style={[
            styles.slider,
            { width: SCREEN_W * 4, transform: [{ translateX: slide }] },
          ]}
        >
          {/* STEP 1 — Choose Admin */}
          <View style={[styles.slide, { width: SCREEN_W }]}>
            <ScrollView
              contentContainerStyle={styles.slideContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.hero}>
                <View style={[styles.heroIcon, { backgroundColor: `${colors.logoBlue}14` }]}>
                  <Ionicons name="people" size={30} color={colors.logoBlue} />
                </View>
                <Text style={[styles.heroTitle, { color: colors.text }]}>
                  Choose your Admin
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                  Each admin manages their own shops. Pick the admin you report
                  to — the shop list next will belong to them.
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                Admin
              </Text>
              <SelectField
                placeholder="Tap to choose an admin…"
                value={selectedAdmin ? `Admin ${adminItems.findIndex((a) => a.key === selectedAdmin.uid) + 1 || 1} · ${selectedAdmin.name}` : null}
                onPress={() => setAdminModal(true)}
                colors={colors}
              />

              <View style={styles.footerArea}>
                {loadingAdmins && admins.length === 0 && (
                  <ActivityIndicator color={colors.logoBlue} style={{ marginVertical: 8 }} />
                )}
                <Pressable
                  onPress={() => selectedAdmin && goTo(1)}
                  disabled={!selectedAdmin}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: selectedAdmin ? colors.logoBlue : colors.border,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text style={[styles.primaryBtnText, { color: primaryText }]}>
                    Continue
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={primaryText} />
                </Pressable>
              </View>
            </ScrollView>
          </View>

          {/* STEP 2 — Your details */}
          <View style={[styles.slide, { width: SCREEN_W }]}>
            <ScrollView
              contentContainerStyle={styles.slideContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.hero}>
                <View style={[styles.heroIcon, { backgroundColor: `${colors.logoBlue}14` }]}>
                  <Ionicons name="person-add" size={30} color={colors.logoBlue} />
                </View>
                <Text style={[styles.heroTitle, { color: colors.text }]}>
                  Your details
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                  Your full name and phone number will be sent to your admin.
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                Full Name
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. John Mwakalinga"
                  placeholderTextColor={colors.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              <Text
                style={[styles.fieldLabel, { color: colors.textMuted, marginTop: spacing.lg }]}
              >
                Phone Number
              </Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. 0712 345 678"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                The admin will use this number to reach you.
              </Text>

              <View style={styles.footerArea}>
                <Pressable
                  onPress={() => detailsValid && (setError(''), goTo(2))}
                  disabled={!detailsValid}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: detailsValid ? colors.logoBlue : colors.border,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text style={[styles.primaryBtnText, { color: primaryText }]}>
                    Continue
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={primaryText} />
                </Pressable>
              </View>
            </ScrollView>
          </View>

          {/* STEP 3 — Choose shop */}
          <View style={[styles.slide, { width: SCREEN_W }]}>
            <ScrollView
              contentContainerStyle={styles.slideContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.hero}>
                <View style={[styles.heroIcon, { backgroundColor: `${colors.logoBlue}14` }]}>
                  <Ionicons name="storefront" size={30} color={colors.logoBlue} />
                </View>
                <Text style={[styles.heroTitle, { color: colors.text }]}>
                  Choose your shop
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                  Shops are updated live by {selectedAdmin?.name ?? 'your admin'}. You
                  pick your shop from this list.
                </Text>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Shop</Text>
              <SelectField
                placeholder="Tap to choose your shop…"
                value={selected ? `${selected.name} · ${regionLabel(selected.region)}` : null}
                onPress={() => setShopModal(true)}
                colors={colors}
              />

              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: `${colors.danger}1A` }]}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.footerArea}>
                {loadingStores && branches.length === 0 && (
                  <ActivityIndicator color={colors.logoBlue} style={{ marginVertical: 8 }} />
                )}
                <Pressable
                  onPress={handleSubmit}
                  disabled={!selected || submitting}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: selected && !submitting ? colors.logoBlue : colors.border,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color={primaryText} />
                  ) : (
                    <>
                      <Text style={[styles.primaryBtnText, { color: selected ? primaryText : colors.textMuted }]}>
                        Complete Registration
                      </Text>
                      <Ionicons name="checkmark-circle" size={18} color={selected ? primaryText : colors.textMuted} />
                    </>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>

          {/* STEP 4 — Success */}
          <View style={[styles.slide, styles.successSlide, { width: SCREEN_W }]}>
            <View style={styles.successWrap}>
              <View style={styles.confettiTop}>
                <Ionicons name="sparkles" size={20} color="#FFD166" />
                <Ionicons name="star" size={16} color="#06D6A0" />
              </View>

              <View style={styles.successCircleOuter}>
                <View style={styles.successCircleInner}>
                  <Ionicons name="checkmark" size={48} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.successTitle}>Congratulations!</Text>
              <Text style={styles.successSubtitle}>
                You've successfully completed your registration.
              </Text>
              <View style={styles.successDivider} />
              <Text style={styles.successWait}>
                Wait for your Admin to approve your request
              </Text>
              <Text style={styles.successWaitSub}>
                Once approved, this app will open automatically — you don't have to do anything.
              </Text>

              <Pressable
                onPress={() => profile && onComplete(profile)}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  styles.successBtn,
                  { backgroundColor: colors.logoBlue, transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                <Text style={[styles.primaryBtnText, { color: primaryText }]}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={primaryText} />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Admin list modal */}
      <ListModal
        visible={adminModal}
        title="Choose your Admin"
        placeholder="Tap an admin to select them"
        items={adminItems}
        selectedKey={selectedAdmin?.uid ?? null}
        loading={loadingAdmins}
        emptyText="No admins available yet. Ask the system administrator to log in on the admin web first."
        onSelect={(key) => {
          setSelectedAdmin(admins.find((a) => a.uid === key) ?? null);
          setError('');
          setAdminModal(false);
        }}
        onClose={() => setAdminModal(false)}
      />

      {/* Shop list modal */}
      <ListModal
        visible={shopModal}
        title="Choose your Shop"
        placeholder="Tap your shop to select it"
        items={shopItems}
        selectedKey={selected?.id ?? null}
        loading={loadingStores}
        emptyText={
          selectedAdmin
            ? `No shops for ${selectedAdmin.name} yet. Ask them to add your shop first.`
            : 'Choose an admin first to see their shops.'
        }
        onSelect={(key) => {
          setSelected(branches.find((b) => b.id === key) ?? null);
          setError('');
          setShopModal(false);
        }}
        onClose={() => setShopModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerLogo: {
    width: 34,
    height: 34,
  },
  headerCenter: {
    alignItems: 'center',
  },
  brandName: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  brandSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 1,
  },
  stepsWrap: {
    flexDirection: 'row',
    gap: 6,
    width: 46,
    justifyContent: 'flex-end',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  slider: {
    flex: 1,
    flexDirection: 'row',
  },
  slide: {
    flex: 1,
  },
  slideContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 21,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 330,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  fieldHint: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    marginTop: spacing.sm,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
  },
  selectFieldText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  selectChevronWrap: {
    marginLeft: spacing.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    paddingVertical: 14,
  },
  footerArea: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 15,
  },
  primaryBtnText: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.lg,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '75%',
  },
  modalGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,120,120,0.35)',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: spacing.md,
  },
  modalList: {
    flexShrink: 1,
    gap: 0,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  modalRowMain: {
    flex: 1,
  },
  modalRowLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  modalRowTrailing: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 1,
  },
  modalEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  modalEmptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  successSlide: {
    backgroundColor: '#F0FBFF',
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  confettiTop: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    opacity: 0.7,
  },
  successCircleOuter: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: 'rgba(6,214,160,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successCircleInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#06D6A0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06D6A0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  successTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: '#0B5B4B',
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: '#1F7A66',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  successDivider: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD166',
    marginVertical: spacing.lg,
  },
  successWait: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    color: '#0B5B4B',
    textAlign: 'center',
  },
  successWaitSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: '#2A6E5F',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
    marginTop: spacing.sm,
  },
  successBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
  },
});