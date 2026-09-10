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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import ModuleHeader from '../components/ModuleHeader';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import {
  getApprovedSalesRevenue,
  getCurrentManager,
  getDayMoneyOut,
  getPreviousDayCountedCash,
  submitCashReconciliation,
  subscribeCashReconciliation,
} from '../services/storeService';
import type { CashReconciliation, ManagerProfile } from '../services/types';
import { shareOverallReportPdf } from '../utils/overallReportPdf';

type Props = NativeStackScreenProps<RootStackParamList, 'CashReconciliation'>;

function formatTsh(amount: number) {
  return `TSh ${amount.toLocaleString('en-US')}`;
}

function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function shiftDate(key: string, days: number): string {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(key: string): string {
  const d = new Date(key + 'T12:00:00Z');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const DENOMS = [10000, 5000, 2000, 1000, 500, 200, 100];

export default function CashReconciliationScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [rec, setRec] = useState<CashReconciliation | null>(null);
  const [revenue, setRevenue] = useState(0);
  const [revLoading, setRevLoading] = useState(true);
  const [date, setDate] = useState(() => todayKey());

  const [openingCash, setOpeningCash] = useState('');
  const [openingSource, setOpeningSource] = useState<string | undefined>();
  const [cashIn, setCashIn] = useState('');
  const [cashOut, setCashOut] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadedRevFor, setLoadedRevFor] = useState<string | null>(null);
  const [loadedOpeningFor, setLoadedOpeningFor] = useState<string | null>(null);
  const [moneyOut, setMoneyOut] = useState({ expenses: 0, receiving: 0, request: 0, total: 0 });
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    getCurrentManager().then((m) => {
      if (cancelled) return;
      if (!m?.branchId) return;
      setManager(m);
      unsub = subscribeCashReconciliation(
        m.branchId,
        (r) => { if (!cancelled) setRec(r); },
        () => {},
        date
      );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [date]);

  // Pakua sales revenue kutoka kwenye closing approved ya siku hiyo.
  useEffect(() => {
    if (!manager?.branchId) return;
    let cancelled = false;
    setRevLoading(true);
    getApprovedSalesRevenue(manager.branchId, date)
      .then((v) => {
        if (!cancelled) {
          setRevenue(v);
          setLoadedRevFor(date);
        }
      })
      .finally(() => {
        if (!cancelled) setRevLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [manager?.branchId, date]);

  // Opening cash = counted ya siku iliyopita; money-out = expenses + receiving + request ya leo.
  useEffect(() => {
    if (!manager?.branchId) return;
    let cancelled = false;
    setMoneyLoading(true);
    Promise.all([
      getDayMoneyOut(manager.branchId, date),
      getPreviousDayCountedCash(manager.branchId, date),
    ])
      .then(([mo, prev]) => {
        if (cancelled) return;
        setMoneyOut(mo);
        setOpeningSource(prev.cash > 0 ? `From closing of ${prev.sourceDate}` : undefined);
        if (loadedOpeningFor !== date) {
          setOpeningCash(prev.cash > 0 ? String(prev.cash) : '');
          setLoadedOpeningFor(date);
        }
      })
      .finally(() => {
        if (!cancelled) setMoneyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [manager?.branchId, date]);

  const num = (v: string) => {
    const n = Number(v.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const opCash = num(openingCash);
  const inCash = num(cashIn);
  const outCash = num(cashOut);

  const countedTotal = useMemo(() => {
    let sum = 0;
    for (const d of DENOMS) {
      sum += num(counts[String(d)] ?? '') * d;
    }
    return sum;
  }, [counts]);

  const expectedCash = revenue - moneyOut.expenses;
  const variance = countedTotal - expectedCash;
  const varianceKind = variance === 0 ? 'matched' : variance < 0 ? 'shortage' : 'overage';

  const handleSubmit = async () => {
    if (!manager) return;
    if (countedTotal <= 0) {
      Alert.alert('Count the Cash', 'Enter the number of notes/coins you counted in the till first.');
      return;
    }
    setSubmitting(true);
    const res = await submitCashReconciliation(
      manager,
      {
        salesRevenue: revenue,
        openingCash: opCash,
        openingCashSource: openingSource,
        cashIn: inCash,
        cashOut: outCash,
        expensesTotal: moneyOut.expenses,
        receivingTotal: moneyOut.receiving,
        requestTotal: moneyOut.request,
        moneyOut: moneyOut.expenses,
        countedCash: countedTotal,
        note,
      },
      date
    );
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert('Submission Failed', res.message ?? 'Try again.');
      return;
    }
    setRec({
      id: res.docId ?? `${manager.branchId}_${date}`,
      shopId: manager.branchId,
      shopName: manager.branchName,
      date,
      openingCash: opCash,
      openingCashSource: openingSource,
      salesRevenue: revenue,
      cashIn: inCash,
      cashOut: outCash,
      expensesTotal: moneyOut.expenses,
      receivingTotal: moneyOut.receiving,
      requestTotal: moneyOut.request,
      moneyOut: moneyOut.expenses,
      expectedCash,
      countedCash: countedTotal,
      variance,
      varianceKind,
      note: note.trim() || undefined,
      managerName: manager.fullName,
      status: 'pending_admin',
      submittedAt: new Date().toISOString(),
    });
  };

  const setCount = (d: number, v: string) => {
    setCounts((prev) => ({ ...prev, [String(d)]: v.replace(/[^0-9]/g, '') }));
  };

  const handleSharePdf = async () => {
    if (!rec || sharingPdf) return;
    setSharingPdf(true);
    const res = await shareOverallReportPdf({ rec, managerName: rec.managerName });
    setSharingPdf(false);
    if (!res.ok) {
      Alert.alert('PDF Failed', res.message);
    }
  };

  const renderDateStepper = () => {
    const today = todayKey();
    const canForward = date < today;
    return (
      <View style={styles.dateStepper}>
        <Pressable style={styles.dateStepperBtn} onPress={() => setDate(shiftDate(date, -1))} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.sky} />
        </Pressable>
        <Text style={styles.dateStepperLabel}>Cash count for · {formatDateLabel(date)}</Text>
        <Pressable
          style={[styles.dateStepperBtn, !canForward && styles.dateStepperBtnDisabled]}
          disabled={!canForward}
          onPress={() => setDate(shiftDate(date, 1))}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={18} color={canForward ? colors.sky : colors.border} />
        </Pressable>
      </View>
    );
  };

  // Ikiwa tayari imewasilishwa — onyesha muhtasari na hali yake.
  if (rec) {
    const kindColor =
      rec.varianceKind === 'matched' ? colors.success : rec.varianceKind === 'shortage' ? colors.danger : colors.gold;
    const kindLabel =
      rec.varianceKind === 'matched'
        ? 'Matched — No variance'
        : rec.varianceKind === 'shortage'
          ? 'Shortage of cash'
          : 'Overage of cash';
    return (
      <View style={styles.flex}>
        <ModuleHeader
          title="Cash Reconciliation"
          subtitle="Cash in hand vs expected cash"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <View style={styles.card}>
            <Text style={styles.centerTitle}>Reconciliation for {rec.date}</Text>
            <View style={styles.kindBadgeWrap}>
              <View style={[styles.kindBadge, { backgroundColor: kindColor }]}>
                <Ionicons
                  name={rec.varianceKind === 'matched' ? 'checkmark-circle' : 'warning'}
                  size={16}
                  color={colors.white}
                />
                <Text style={styles.kindBadgeText}>{kindLabel}</Text>
              </View>
            </View>

            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Opening cash (morning)</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.openingCash)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Sales revenue (auto)</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.salesRevenue)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Expenses (money out from till)</Text>
              <Text style={styles.sumValue}>− {formatTsh(rec.expensesTotal)}</Text>
            </View>
            <View style={[styles.sumRow, styles.sumRowBold]}>
              <Text style={styles.sumLabelBold}>Total money out (from till)</Text>
              <Text style={styles.sumValueBold}>− {formatTsh(rec.moneyOut)}</Text>
            </View>
            <View style={[styles.sumRow, styles.sumRowBold]}>
              <Text style={styles.sumLabelBold}>Stock purchases (paid by admin — from outside)</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.receivingTotal + rec.requestTotal)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>     Stock Receiving (not from till)</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.receivingTotal)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>     Stock Requests (not from till)</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.requestTotal)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Cash added to till</Text>
              <Text style={styles.sumValue}>+ {formatTsh(rec.cashIn)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Cash taken from till</Text>
              <Text style={styles.sumValue}>− {formatTsh(rec.cashOut)}</Text>
            </View>
            <View style={[styles.sumRow, styles.sumRowBold]}>
              <Text style={styles.sumLabelBold}>Expected cash</Text>
              <Text style={styles.sumValueBold}>{formatTsh(rec.expectedCash)}</Text>
            </View>
            <Text style={styles.sumNote}>
              Expected = Sales − Expenses. Stock purchases are already inside Sales.
            </Text>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Counted in till</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.countedCash)}</Text>
            </View>
            {rec.adminAdjustment !== undefined && (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Admin adjustment</Text>
                <Text style={[styles.sumValue, { color: rec.adminAdjustment >= 0 ? colors.gold : colors.danger }]}>
                  {rec.adminAdjustment >= 0 ? '+' : '−'} {formatTsh(Math.abs(rec.adminAdjustment))}
                </Text>
              </View>
            )}
            <View style={[styles.sumRow, styles.sumRowBold]}>
              <Text style={styles.sumLabelBold}>Variance</Text>
              <Text style={[styles.sumValueBold, { color: kindColor }]}>
                {rec.variance > 0 ? '+' : ''}{formatTsh(rec.variance)}
              </Text>
            </View>
            {rec.note ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabel}>Manager's note</Text>
                <Text style={styles.noteText}>{rec.note}</Text>
              </View>
            ) : null}
            <View style={[styles.statusRow, { backgroundColor: rec.status === 'approved' ? `${colors.success}1A` : `${colors.gold}1A` }]}>
              <Ionicons
                name={rec.status === 'approved' ? 'checkmark-done-circle' : 'time-outline'}
                size={18}
                color={rec.status === 'approved' ? colors.success : colors.gold}
              />
              <Text style={[styles.statusText, { color: rec.status === 'approved' ? colors.success : colors.gold }]}>
                {rec.status === 'approved'
                  ? 'Approved by admin — cash reconciled.'
                  : 'Pending admin review.'}
              </Text>
            </View>
          </View>
          <Pressable style={[styles.doneBtn, { marginBottom: spacing.sm }]} onPress={handleSharePdf} disabled={sharingPdf}>
            <Ionicons name="download-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.doneBtnText}>
              {sharingPdf ? 'Preparing…' : 'Download Overall Report (PDF)'}
            </Text>
          </Pressable>
          <Pressable style={[styles.doneBtn, { backgroundColor: colors.border }]} onPress={() => navigation.goBack()}>
            <Text style={[styles.doneBtnText, { color: colors.navy }]}>Back to Home</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ModuleHeader
        title="Cash Reconciliation"
        subtitle="Cash in hand vs expected cash"
        onBack={() => navigation.goBack()}
      />
      {renderDateStepper()}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.noticeCard}>
          <Ionicons name="cash-outline" size={18} color={colors.sky} />
          <Text style={styles.noticeText}>
            Expected cash = today's Sales (from Daily Closing) − today's Expenses.
            Stock purchases are already inside Sales — nothing else is subtracted here.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Building Expected Cash</Text>
          <View style={styles.fieldRow}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Opening cash (morning)</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={openingCash}
                onChangeText={setOpeningCash}
              />
              {openingSource ? <Text style={styles.autoHint}>{openingSource}</Text> : <Text style={styles.autoHint}>For the report only.</Text>}
            </View>
            <View style={styles.fieldBoxAuto}>
              <Text style={styles.fieldLabel}>Sales revenue (from approved closing)</Text>
              <Text style={styles.autoValue}>
                {revLoading ? '…' : formatTsh(revenue)}
              </Text>
              {!revLoading && revenue === 0 && (
                <Text style={styles.autoHint}>
                  No approved closing yet for this day — revenue is 0.
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.fieldBox, styles.moneyBox]}>
            <Text style={styles.fieldLabel}>EXPENSES FROM TILL (auto from Expenses module)</Text>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLabel}>Expenses</Text>
              <Text style={styles.moneyValue}>− {formatTsh(moneyOut.expenses)}</Text>
            </View>
            <View style={[styles.moneyRow, styles.moneyRowTotal]}>
              <Text style={styles.moneyLabelTotal}>TOTAL MONEY OUT (from till)</Text>
              <Text style={[styles.moneyValue, { color: colors.gold }]}>
                − {moneyLoading ? '…' : formatTsh(moneyOut.expenses)}
              </Text>
            </View>
          </View>

          <View style={[styles.fieldBox, styles.purchaseBox]}>
            <Text style={styles.fieldLabel}>STOCK PURCHASES — PAID BY ADMIN (money from outside)</Text>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLabel}>Stock Receiving</Text>
              <Text style={styles.moneyValue}>{formatTsh(moneyOut.receiving)}</Text>
            </View>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLabel}>Stock Requests</Text>
              <Text style={styles.moneyValue}>{formatTsh(moneyOut.request)}</Text>
            </View>
            <Text style={styles.autoHint}>
              Added to current stock when admin approves — not subtracted from the till.
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Cash added to till</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={cashIn}
                onChangeText={setCashIn}
              />
            </View>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Cash taken from till</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={cashOut}
                onChangeText={setCashOut}
              />
            </View>
          </View>
          <Text style={styles.autoHint}>Opening &amp; cash movements — for the report only.</Text>
          <View style={styles.expectedBox}>
            <Text style={styles.expectedLabel}>EXPECTED CASH</Text>
            <Text style={styles.expectedValue}>{formatTsh(expectedCash)}</Text>
            <Text style={styles.expectedHint}>
              Sales − Expenses · stock purchases already inside Sales
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Count the Till — notes &amp; coins</Text>
          {DENOMS.map((d) => (
            <View key={d} style={styles.denomRow}>
              <View style={styles.denomBox}>
                <Ionicons name="cash-outline" size={14} color={colors.text} />
                <Text style={styles.denomLabel}>{formatTsh(d)}</Text>
              </View>
              <TextInput
                style={styles.denomInput}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={counts[String(d)] ?? ''}
                onChangeText={(v) => setCount(d, v)}
              />
              <Text style={styles.denomSubtotal}>
                {formatTsh(num(counts[String(d)] ?? '') * d)}
              </Text>
            </View>
          ))}
          <View style={[styles.countedBox, { backgroundColor: colors.logoBlueDeep }]}>
            <Text style={styles.countedLabel}>COUNTED TOTAL</Text>
            <Text style={styles.countedValue}>{formatTsh(countedTotal)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Variance</Text>
          <View style={styles.varianceBox}>
            <View style={styles.varianceCol}>
              <Text style={styles.varianceLabel}>Expected</Text>
              <Text style={styles.varianceValue}>{formatTsh(expectedCash)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
            <View style={styles.varianceCol}>
              <Text style={styles.varianceLabel}>Counted</Text>
              <Text style={styles.varianceValue}>{formatTsh(countedTotal)}</Text>
            </View>
          </View>
          <View
            style={[
              styles.kindBadge,
              {
                backgroundColor:
                  varianceKind === 'matched' ? colors.success : varianceKind === 'shortage' ? colors.danger : colors.gold,
                marginTop: spacing.md,
              },
            ]}
          >
            <Ionicons
              name={varianceKind === 'matched' ? 'checkmark-circle' : 'warning'}
              size={16}
              color={colors.white}
            />
            <Text style={styles.kindBadgeText}>
              {varianceKind === 'matched'
                ? 'Matched — no variance'
                : varianceKind === 'shortage'
                  ? `Shortage ${formatTsh(Math.abs(variance))}`
                  : `Overage ${formatTsh(Math.abs(variance))}`}
            </Text>
          </View>
          {varianceKind !== 'matched' && (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Explain the difference (required)</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                placeholder="Why is there a difference? e.g. change given, damaged notes…"
                placeholderTextColor={colors.textMuted}
                multiline
                value={note}
                onChangeText={setNote}
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.submitBar, { bottom: insets.bottom }]}>
        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Submitting…' : 'Submit Reconciliation to Admin'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    noticeCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
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
    sectionTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 14,
      color: c.text,
      marginBottom: spacing.sm,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    fieldBox: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    fieldBoxAuto: {
      flex: 1,
      backgroundColor: `${c.sky}1A`,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    moneyBox: {
      marginBottom: spacing.sm,
    },
    purchaseBox: {
      backgroundColor: `${c.gold}1A`,
      marginBottom: spacing.sm,
    },
    moneyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 3,
    },
    moneyRowTotal: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: spacing.xs,
      paddingTop: spacing.xs + 2,
    },
    moneyLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.text,
    },
    moneyLabelTotal: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      color: c.text,
    },
    moneyValue: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.text,
    },
    fieldLabel: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
      marginBottom: 4,
    },
    input: {
      fontFamily: fonts.headingBold,
      fontSize: 18,
      color: c.text,
      padding: 0,
    },
    autoValue: {
      fontFamily: fonts.headingBold,
      fontSize: 18,
      color: c.sky,
    },
    autoHint: {
      fontFamily: fonts.body,
      fontSize: 10.5,
      color: c.textMuted,
      marginTop: 2,
    },
    expectedBox: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm + 2,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    expectedLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
      color: c.navy,
      letterSpacing: 0.5,
    },
    expectedValue: {
      fontFamily: fonts.headingBold,
      fontSize: 22,
      color: c.navy,
      marginVertical: 2,
    },
    expectedHint: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: c.textMuted,
    },
    denomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    denomBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    denomLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    denomInput: {
      width: 72,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      fontFamily: fonts.headingBold,
      fontSize: 16,
      color: c.text,
      textAlign: 'center',
    },
    denomSubtotal: {
      width: 90,
      textAlign: 'right',
      fontFamily: fonts.bodyMedium,
      fontSize: 12.5,
      color: c.textMuted,
    },
    countedBox: {
      borderRadius: radius.sm,
      padding: spacing.sm + 2,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    countedLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 0.5,
    },
    countedValue: {
      fontFamily: fonts.headingBold,
      fontSize: 22,
      color: c.white,
      marginVertical: 2,
    },
    varianceBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      gap: spacing.sm,
    },
    varianceCol: {
      alignItems: 'center',
    },
    varianceLabel: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
    },
    varianceValue: {
      fontFamily: fonts.headingBold,
      fontSize: 17,
      color: c.text,
    },
    kindBadgeWrap: {
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    kindBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      alignSelf: 'center',
    },
    kindBadgeText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.white,
    },
    noteBox: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    noteLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      color: c.text,
      marginBottom: 4,
    },
    noteInput: {
      minHeight: 56,
    },
    noteText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.text,
    },
    sumRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    sumRowBold: {
      borderBottomWidth: 0,
    },
    sumLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textMuted,
    },
    sumLabelBold: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    sumValue: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    sumValueBold: {
      fontFamily: fonts.headingBold,
      fontSize: 14,
      color: c.text,
    },
    sumNote: {
      fontFamily: fonts.body,
      fontSize: 10.5,
      color: c.textMuted,
      lineHeight: 15,
      marginTop: spacing.xs,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.sm,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    statusText: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 12.5,
    },
    centerTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 15,
      color: c.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
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
    doneBtn: {
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    doneBtnText: {
      fontFamily: fonts.bodySemiBold,
      color: c.white,
      fontSize: 14,
    },
    dateStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginVertical: spacing.sm,
    },
    dateStepperBtn: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.pill,
      padding: 8,
    },
    dateStepperBtnDisabled: {
      backgroundColor: c.surfaceAlt,
      opacity: 0.5,
    },
    dateStepperLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
  });