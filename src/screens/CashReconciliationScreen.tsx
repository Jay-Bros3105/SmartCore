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
import AppWatermark from '../components/AppWatermark';
import { fonts, radius, spacing } from '../theme/theme';
import {
  getApprovedSalesRevenue,
  getCurrentManager,
  getDayMoneyOut,
  getOpeningStockTotalDate,
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

export default function CashReconciliationScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [rec, setRec] = useState<CashReconciliation | null>(null);
  const [revenue, setRevenue] = useState(0);
  const [revLoading, setRevLoading] = useState(true);
  const [date, setDate] = useState(() => todayKey());

  const [handedOver, setHandedOver] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [moneyOut, setMoneyOut] = useState({ expenses: 0, receiving: 0, request: 0, total: 0 });
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [openingStockValue, setOpeningStockValue] = useState(0);
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

  // Pakua sales revenue (stock closed) kutoka kwenye closing approved ya siku hiyo.
  useEffect(() => {
    if (!manager?.branchId) return;
    let cancelled = false;
    setRevLoading(true);
    getApprovedSalesRevenue(manager.branchId, date)
      .then((v) => {
        if (!cancelled) setRevenue(v);
      })
      .finally(() => {
        if (!cancelled) setRevLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [manager?.branchId, date]);

  // Money-out (Expenses + Stock Receiving + Stock Requests) na thamani ya opening stock.
  useEffect(() => {
    if (!manager?.branchId) return;
    let cancelled = false;
    setMoneyLoading(true);
    Promise.all([
      getDayMoneyOut(manager.branchId, date),
      getOpeningStockTotalDate(manager.branchId, date),
    ])
      .then(([mo, openingTotal]) => {
        if (cancelled) return;
        setMoneyOut(mo);
        setOpeningStockValue(openingTotal);
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

  const handed = num(handedOver);
  const expectedCash = revenue - moneyOut.expenses;
  const variance = handed - expectedCash;
  const varianceKind = variance === 0 ? 'matched' : variance < 0 ? 'shortage' : 'overage';

  const handleSubmit = async () => {
    if (!manager) return;
    if (handed <= 0) {
      Alert.alert('Enter Cash Handed Over', 'Enter the cash received by admin from you first.');
      return;
    }
    setSubmitting(true);
    const res = await submitCashReconciliation(
      manager,
      {
        salesRevenue: revenue,
        openingCash: 0,
        openingStockValue,
        cashIn: 0,
        cashOut: 0,
        expensesTotal: moneyOut.expenses,
        receivingTotal: moneyOut.receiving,
        requestTotal: moneyOut.request,
        moneyOut: moneyOut.expenses,
        countedCash: handed,
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
      openingCash: 0,
      openingStockValue,
      salesRevenue: revenue,
      cashIn: 0,
      cashOut: 0,
      expensesTotal: moneyOut.expenses,
      receivingTotal: moneyOut.receiving,
      requestTotal: moneyOut.request,
      moneyOut: moneyOut.expenses,
      expectedCash,
      countedCash: handed,
      variance,
      varianceKind,
      managerName: manager.fullName,
      status: 'pending_admin',
      submittedAt: new Date().toISOString(),
    });
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
        <Text style={styles.dateStepperLabel}>Cash handed over for · {formatDateLabel(date)}</Text>
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
        ? 'Cash Matches — No variance'
        : rec.varianceKind === 'shortage'
          ? 'Shortage of cash'
          : 'Overage of cash';
    return (
      <View style={styles.flex}>
        <AppWatermark />
        <ModuleHeader
          title="Cash Reconciliation"
          subtitle="Cash handed to admin vs expected cash"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <View style={styles.card}>
            <Text style={styles.centerTitle}>Cash Reconciliation · {rec.date}</Text>
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
              <Text style={styles.sumLabel}>Opening stock value (goods in hand)</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.openingStockValue)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Stock received (added money to till)</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.receivingTotal)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Expenses (money out from till)</Text>
              <Text style={styles.sumValue}>− {formatTsh(rec.expensesTotal)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Stock closed (sales revenue)</Text>
              <Text style={styles.sumValue}>{formatTsh(rec.salesRevenue)}</Text>
            </View>
            <View style={[styles.sumRow, styles.sumRowBold]}>
              <Text style={styles.sumLabelBold}>Expected cash</Text>
              <Text style={styles.sumValueBold}>{formatTsh(rec.expectedCash)}</Text>
            </View>
            <Text style={styles.sumNote}>
              Expected = Sales (stock closed) − Expenses. Stock purchases are already inside Sales.
            </Text>
            <View style={[styles.sumRow, { borderBottomWidth: 0, marginTop: spacing.xs }]}>
              <Text style={styles.sumLabel}>Cash handed over to admin</Text>
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
              {sharingPdf ? 'Preparing…' : 'Download Full Report (PDF)'}
            </Text>
          </Pressable>
          <Pressable style={[styles.doneBtn, { backgroundColor: colors.border }]} onPress={() => navigation.goBack()}>
            <Text style={[styles.doneBtnText, { color: colors.navy }]}>Back to Home</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const previewColor =
    varianceKind === 'matched' ? colors.success : varianceKind === 'shortage' ? colors.danger : colors.gold;
  const previewLabel =
    varianceKind === 'matched'
      ? 'Cash Matches — No variance'
      : varianceKind === 'shortage'
        ? `Shortage of ${formatTsh(Math.abs(variance))}`
        : `Overage of ${formatTsh(Math.abs(variance))}`;

  return (
    <View style={styles.flex}>
      <AppWatermark />
      <ModuleHeader
        title="Cash Reconciliation"
        subtitle="Cash handed to admin vs expected cash"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        {renderDateStepper()}

        <View style={styles.noticeCard}>
          <Ionicons name="information-circle" size={18} color={colors.sky} />
          <Text style={styles.noticeText}>
            Since closing stock and expenses are already recorded, just enter the cash you handed over to the
            admin. The system compares it with the expected cash automatically — and you can download the full
            report with the opening stock, received stock, expenses and stock closed.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Day summary</Text>
          {moneyLoading || revLoading ? (
            <ActivityIndicator color={colors.sky} style={{ marginTop: spacing.sm }} />
          ) : (
            <>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Stock closed (sales revenue)</Text>
                <Text style={styles.sumValue}>{formatTsh(revenue)}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Stock received (added money)</Text>
                <Text style={styles.sumValue}>{formatTsh(moneyOut.receiving)}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Expenses (money out from till)</Text>
                <Text style={styles.sumValue}>− {formatTsh(moneyOut.expenses)}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Opening stock value (goods)</Text>
                <Text style={styles.sumValue}>{formatTsh(openingStockValue)}</Text>
              </View>
              <View style={[styles.sumRow, styles.sumRowBold]}>
                <Text style={styles.sumLabelBold}>Expected cash</Text>
                <Text style={styles.sumValueBold}>{formatTsh(expectedCash)}</Text>
              </View>
              <Text style={styles.sumNote}>Expected = Sales − Expenses. Stock purchases are already inside Sales.</Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cash handed over to admin</Text>
          <TextInput
            style={styles.input}
            value={handedOver}
            onChangeText={(t) => setHandedOver(t.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 350000"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            editable={!submitting}
          />
          <Text style={styles.autoHint}>Total cash the admin received from you for this day.</Text>
        </View>

        {handedOver.length > 0 ? (
          <View style={[styles.expectedBox, { backgroundColor: previewColor }]}>
            <Text style={[styles.countedLabel]}>{previewLabel}</Text>
            <Text style={styles.countedValue}>{formatTsh(variance)}</Text>
          </View>
        ) : (
          <View style={[styles.expectedBox, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.expectedLabel, { color: colors.navy }]}>Enter cash to compare</Text>
            <Text style={[styles.autoHint, { marginTop: 2 }]}>{formatTsh(expectedCash)} is expected for this day.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.submitBar, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>Send Reconciliation to Admin</Text>
          )}
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
    input: {
      fontFamily: fonts.headingBold,
      fontSize: 24,
      color: c.text,
      padding: 0,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      paddingBottom: spacing.xs,
      marginBottom: spacing.xs,
    },
    autoHint: {
      fontFamily: fonts.body,
      fontSize: 10.5,
      color: c.textMuted,
      marginTop: 2,
    },
    expectedBox: {
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    expectedLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
      color: c.navy,
      letterSpacing: 0.5,
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