import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import {
  applyShopChange,
  getActiveShopChange,
  getCurrentManager,
  submitShopChange,
  subscribeBranches,
  subscribeShopChange,
} from '../services/storeService';
import type { Branch, ManagerProfile, ShopChangeRequest } from '../services/types';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopChange'>;

export default function ShopChangeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [toBranch, setToBranch] = useState<Branch | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<ShopChangeRequest | null>(null);
  const [pickOpen, setPickOpen] = useState(false);

  useEffect(() => {
    getCurrentManager().then((m) => {
      setManager(m);
      if (m) setName(m.fullName ?? '');
    });
    getActiveShopChange().then(setRequest).catch(() => setRequest(null));
    const unsub = subscribeShopChange((r) => {
      if (r && r.status === 'approved') {
        setRequest(r);
        void applyShopChange(r).then(() => {
          Alert.alert('Shop Changed', `Welcome to ${r.shopToName}. You now work at this shop.`);
          navigation.goBack();
        });
      } else if (r) {
        setRequest(r);
      } else {
        setRequest(null);
      }
    });
    const unsubB = subscribeBranches(undefined, (bs) => setBranches(bs.filter((b) => b.status === 'active')));
    return () => {
      unsub();
      unsubB();
    };
  }, [navigation]);

  const selectable = branches.filter((b) => b.id !== manager?.branchId);

  const handleSubmit = async () => {
    if (!toBranch || !name.trim()) return;
    setSubmitting(true);
    try {
      const res = await submitShopChange(toBranch);
      if (res.ok) {
        void getActiveShopChange().then(setRequest);
      } else {
        Alert.alert('Cannot Submit', res.message ?? 'Please try again.');
      }
    } catch {
      Alert.alert('Cannot Submit', 'Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPending = () => {
    const r = request;
    if (!r) return null;
    return (
      <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Request Submitted</Text>
        {r.status === 'approved' ? (
          <Text style={[styles.pendingBody, { color: colors.textMuted }]}>
            Approved — you are now moving to {r.shopToName}.
          </Text>
        ) : (
          <>
            <Text style={[styles.pendingRow, { color: colors.text }]}>
              <Text style={styles.pendingLabel}>From: </Text>
              {r.shopFromName}
            </Text>
            <Text style={[styles.pendingRow, { color: colors.text }]}>
              <Text style={styles.pendingLabel}>To: </Text>
              {r.shopToName}
            </Text>
            <Text style={[styles.pendingBody, { color: colors.textMuted }]}>
              Waiting for your admin's approval. You will be moved only after it is confirmed.
            </Text>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Change Shop</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Changing shop is a formal action. Fill in where you are leaving from, the shop you are
            moving to, and your name. Your admin confirms before you switch.
          </Text>

          <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>From (current shop)</Text>
            <View style={[styles.fromBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="storefront" size={16} color={colors.logoBlue} />
              <Text style={[styles.fromText, { color: colors.text }]}>
                {manager?.branchName ?? '—'}
              </Text>
            </View>
          </View>

          {request && request.status === 'pending_admin' ? (
            renderPending()
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>To (shop you are moving to)</Text>
                <Pressable
                  onPress={() => setPickOpen(true)}
                  style={[styles.select, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  {toBranch ? (
                    <Text style={[styles.selectText, { color: colors.text }]}>{toBranch.name}</Text>
                  ) : (
                    <Text style={[styles.selectPlaceholder, { color: colors.textMuted }]}>Choose a shop</Text>
                  )}
                  <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                </Pressable>
              </View>

              <View style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                />
              </View>

              <Pressable
                onPress={handleSubmit}
                disabled={submitting || !toBranch || !name.trim()}
                style={[
                  styles.submitBtn,
                  (submitting || !toBranch || !name.trim()) && { opacity: 0.6 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Request</Text>
                )}
              </Pressable>
              <Text style={[styles.footnote, { color: colors.textMuted }]}>
                You will not switch shops until your admin approves.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={pickOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickOpen(false)}
      >
        <View style={[styles.overlay, { backgroundColor: 'rgba(16,32,46,0.55)' }]}>
          <View style={[styles.sheet, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose a shop</Text>
              <Pressable onPress={() => setPickOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {selectable.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No other active shops.</Text>
              ) : (
                selectable.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      setToBranch(b);
                      setPickOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.shopRow,
                      { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <View style={styles.shopRowLeft}>
                      <Ionicons name="storefront-outline" size={17} color={colors.logoBlue} />
                      <Text style={[styles.shopRowText, { color: colors.text }]}>{b.name}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
    marginBottom: 6,
  },
  fromBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  fromText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  selectText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  selectPlaceholder: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#0285C7',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  submitBtnText: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
    color: '#fff',
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  pendingRow: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    marginVertical: 2,
  },
  pendingLabel: {
    fontFamily: fonts.bodySemiBold,
  },
  pendingBody: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
  },
  shopRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shopRowText: {
    fontFamily: fonts.body,
    fontSize: 14,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
});