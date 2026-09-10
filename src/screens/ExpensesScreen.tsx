import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import ModuleHeader from '../components/ModuleHeader';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, radius, spacing } from '../theme/theme';
import {
  getCurrentManager,
  submitExpenses,
  subscribeExpenses,
} from '../services/storeService';
import type { ExpenseSubmission, ManagerProfile } from '../services/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Expenses'>;

function formatTsh(amount: number) {
  return `TSh ${amount.toLocaleString('en-US')}`;
}

function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const CATEGORIES = ['Transport', 'Utilities', 'Supplies', 'Cleaning', 'Repairs', 'Other'];

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Transport: 'bus-outline',
  Utilities: 'flash-outline',
  Supplies: 'bag-handle-outline',
  Cleaning: 'water-outline',
  Repairs: 'hammer-outline',
  Other: 'receipt-outline',
};

type Row = { key: string; description: string; amount: string; category: string };

let rowSeq = 0;
function newRow(): Row {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, description: '', amount: '', category: 'Other' };
}

export default function ExpensesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [history, setHistory] = useState<ExpenseSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    getCurrentManager().then((m) => {
      if (cancelled) return;
      if (!m?.branchId) {
        setLoading(false);
        return;
      }
      setManager(m);
      unsub = subscribeExpenses(
        m.branchId,
        (list) => {
          if (!cancelled) setHistory(list);
        },
        () => {},
        15
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length === 1 ? [newRow()] : prev.filter((r) => r.key !== key)));

  const amountNum = (v: string) => {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const validRows = rows
    .map((r) => ({ ...r, amt: amountNum(r.amount) }))
    .filter((r) => r.description.trim() && r.amt > 0);
  const total = validRows.reduce((s, r) => s + r.amt, 0);

  const handleSubmit = async () => {
    if (!manager) return;
    if (validRows.length === 0) {
      Alert.alert('Add an Expense', 'Describe what the money was used for and its amount.');
      return;
    }
    setSubmitting(true);
    const res = await submitExpenses(
      manager,
      validRows.map((r) => ({ description: r.description.trim(), amount: r.amt, category: r.category })),
      todayKey()
    );
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert('Submission Failed', res.message ?? 'Try again.');
      return;
    }
    setSubmittedId(res.docId ?? null);
  };

  if (submittedId) {
    return (
      <View style={styles.flex}>
        <ModuleHeader
          title="Expenses"
          subtitle="Add costs and their purpose"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerWrap}>
          <View style={[styles.successIcon, { backgroundColor: colors.gold }]}>
            <Ionicons name="receipt" size={32} color="#1a1305" />
          </View>
          <Text style={styles.successTitle}>Expenses Submitted</Text>
          <Text style={styles.successBody}>
            {validRows.length} expense{validRows.length === 1 ? '' : 's'} · {formatTsh(total)}
            {'\n'}Waiting Admin's Approval.
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to Transactions</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ModuleHeader
        title="Expenses"
        subtitle="Add costs and their purpose"
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sky} />
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        >
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.logoBlue} />
            <Text style={styles.noticeText}>
              Add each expense's purpose and price. The admin will approve it.
            </Text>
          </View>

          {rows.map((r) => {
            const amt = amountNum(r.amount);
            return (
              <View key={r.key} style={styles.card}>
                <View style={styles.cardTop}>
                  <Ionicons name={CATEGORY_ICONS[r.category] ?? 'receipt-outline'} size={17} color={colors.sky} />
                  <Text style={styles.cardTopLabel}>Expense item</Text>
                  {rows.length > 1 && (
                    <Pressable onPress={() => removeRow(r.key)} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color={colors.danger} />
                    </Pressable>
                  )}
                </View>
                <TextInput
                  style={styles.descInput}
                  placeholder="What was the money used for? e.g. Fuel to receive stock…"
                  placeholderTextColor={colors.textMuted}
                  value={r.description}
                  onChangeText={(v) => updateRow(r.key, { description: v })}
                />
                <View style={styles.catRow}>
                  {CATEGORIES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => updateRow(r.key, { category: c })}
                      style={[styles.catChip, r.category === c && { backgroundColor: colors.logoBlueDeep }]}
                    >
                      <Ionicons
                        name={CATEGORY_ICONS[c] ?? 'receipt-outline'}
                        size={11}
                        color={r.category === c ? colors.white : colors.textMuted}
                      />
                      <Text style={[styles.catChipText, r.category === c && { color: colors.white }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Amount (TSh)</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={r.amount}
                    onChangeText={(v) => updateRow(r.key, { amount: v })}
                  />
                  <Text style={styles.amountSub}>{formatTsh(amt)}</Text>
                </View>
              </View>
            );
          })}

          <Pressable style={styles.addBtn} onPress={addRow}>
            <Ionicons name="add-circle" size={18} color={colors.sky} />
            <Text style={styles.addBtnText}>Add another expense</Text>
          </Pressable>

          <View style={[styles.totalBox, { backgroundColor: colors.logoBlueDeep }]}>
            <Text style={styles.totalLabel}>TOTAL EXPENSES</Text>
            <Text style={styles.totalValue}>{formatTsh(total)}</Text>
            <Text style={styles.totalHint}>{validRows.length} item{validRows.length === 1 ? '' : 's'}</Text>
          </View>

          {history.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recent expense records</Text>
              {history.map((h) => (
                <View key={h.id} style={styles.histRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histDate}>{h.date}</Text>
                    {h.items.slice(0, 2).map((it, i) => (
                      <Text key={i} style={styles.histItem} numberOfLines={1}>
                        • {it.description} · <Text style={{ color: colors.gold }}>{formatTsh(it.amount)}</Text>
                      </Text>
                    ))}
                    {h.items.length > 2 && (
                      <Text style={styles.histMore}>+{h.items.length - 2} more</Text>
                    )}
                  </View>
                  <View style={styles.histRight}>
                    <Text style={styles.histTotal}>{formatTsh(h.total)}</Text>
                    <View
                      style={[
                        styles.histBadge,
                        { backgroundColor: h.status === 'approved' ? `${colors.success}1A` : `${colors.gold}1A` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.histBadgeText,
                          { color: h.status === 'approved' ? colors.success : colors.gold },
                        ]}
                      >
                        {h.status === 'approved' ? 'Approved' : 'Waiting Admin'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.submitBar, { bottom: insets.bottom }]}>
        <Pressable style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitBtnText}>
            {submitting ? 'Submitting…' : 'Send Expenses to Admin'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    body: { flex: 1 },
    noticeCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    noticeText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: c.text,
      lineHeight: 17,
    },
    card: {
      backgroundColor: c.bg,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    cardTopLabel: {
      flex: 1,
      fontFamily: fonts.headingBold,
      fontSize: 13,
      color: c.text,
    },
    descInput: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.text,
    },
    catRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: spacing.sm,
    },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    catChipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
      color: c.text,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    amountLabel: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 11.5,
      color: c.text,
    },
    amountInput: {
      width: 90,
      fontFamily: fonts.headingBold,
      fontSize: 16,
      color: c.text,
      textAlign: 'right',
      padding: 0,
    },
    amountSub: {
      width: 90,
      fontFamily: fonts.bodyMedium,
      fontSize: 11.5,
      color: c.textMuted,
      textAlign: 'right',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      marginBottom: spacing.md,
    },
    addBtnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.sky,
    },
    totalBox: {
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    totalLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 0.5,
    },
    totalValue: {
      fontFamily: fonts.headingBold,
      fontSize: 24,
      color: c.white,
      marginVertical: 2,
    },
    totalHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: 'rgba(255,255,255,0.8)',
    },
    sectionTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 13.5,
      color: c.text,
      marginBottom: spacing.sm,
    },
    histRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    histDate: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11.5,
      color: c.textMuted,
    },
    histItem: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.text,
      marginTop: 2,
    },
    histMore: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
    },
    histRight: {
      alignItems: 'flex-end',
    },
    histTotal: {
      fontFamily: fonts.headingBold,
      fontSize: 13,
      color: c.text,
    },
    histBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      marginTop: 4,
    },
    histBadgeText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    mutedText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
    },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    successTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 19,
      color: c.text,
      marginBottom: spacing.xs,
    },
    successBody: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: spacing.xl,
    },
    doneBtn: {
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
    },
    doneBtnText: {
      fontFamily: fonts.bodySemiBold,
      color: c.white,
      fontSize: 14,
    },
    submitBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: spacing.lg,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    submitBtn: {
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.pill,
      paddingVertical: 15,
      alignItems: 'center',
    },
    submitBtnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 15,
      color: c.white,
    },
  });