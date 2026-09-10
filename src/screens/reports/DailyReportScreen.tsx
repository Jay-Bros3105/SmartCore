import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import ModuleHeader from '../../components/ModuleHeader';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { fonts, radius, spacing } from '../../theme/theme';
import {
  getCurrentManager,
  subscribeCashReconciliation,
  subscribeClosingStock,
  subscribeExpenses,
} from '../../services/storeService';
import type { CashReconciliation, ClosingStock, ExpenseSubmission, ManagerProfile } from '../../services/types';
import {
  Badge,
  EmptyState,
  formatDateLabel,
  formatTsh,
  ReportSection,
  shiftDate,
  StatCard,
  todayKey,
} from './ReportShared';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyReport'>;

export default function DailyReportScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [closing, setClosing] = useState<ClosingStock | null>(null);
  const [rec, setRec] = useState<CashReconciliation | null>(null);
  const [expenses, setExpenses] = useState<ExpenseSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => todayKey());

  useEffect(() => {
    let cancelled = false;
    let unClosing: (() => void) | undefined;
    let unRec: (() => void) | undefined;
    let unExp: (() => void) | undefined;
    getCurrentManager().then((m) => {
      if (cancelled) return;
      if (!m?.branchId) {
        setLoading(false);
        return;
      }
      setManager(m);
      unClosing = subscribeClosingStock(
        m.branchId,
        (c) => { if (!cancelled) setClosing(c); },
        () => {},
        date
      );
      unRec = subscribeCashReconciliation(
        m.branchId,
        (r) => { if (!cancelled) setRec(r); },
        () => {},
        date
      );
      unExp = subscribeExpenses(
        m.branchId,
        (list) => {
          if (cancelled) return;
          const day = list.filter((e) => e.date === date);
          setExpenses(day);
        },
        () => {},
        50
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unClosing?.();
      unRec?.();
      unExp?.();
    };
  }, [date]);

  const dayExpenses = useMemo(() => expenses.filter((e) => e.date === date), [expenses, date]);
  const expenseTotal = dayExpenses.reduce((s, e) => s + e.total, 0);
  const revenue = closing?.totalRevenue ?? 0;
  const variance = rec?.variance;
  const varianceColor =
    variance === undefined ? colors.charcoal : variance === 0 ? colors.success : variance < 0 ? colors.danger : colors.gold;

  const renderStepper = () => {
    const today = todayKey();
    const canForward = date < today;
    return (
      <View style={styles.stepper}>
        <Pressable style={styles.stepperBtn} onPress={() => setDate(shiftDate(date, -1))} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.sky} />
        </Pressable>
        <Text style={styles.stepperLabel}>{formatDateLabel(date)}</Text>
        <Pressable
          style={[styles.stepperBtn, !canForward && styles.stepperBtnDisabled]}
          disabled={!canForward}
          onPress={() => setDate(shiftDate(date, 1))}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={18} color={canForward ? colors.sky : colors.border} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <ModuleHeader
        title="Daily Business Report"
        subtitle="Sales, expenses and cash for your shop"
        onBack={() => navigation.goBack()}
      />
      {renderStepper()}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sky} />
          <Text style={styles.muted}>Loading the day's data…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statGrid}>
            <StatCard icon="cash-outline" label="Sales Revenue" value={formatTsh(revenue)} tint={colors.success} />
            <StatCard
              icon="receipt-outline"
              label="Expenses"
              value={formatTsh(expenseTotal)}
              tint={expenseTotal > 0 ? colors.danger : colors.charcoal}
            />
            <StatCard
              icon={variance === 0 ? 'checkmark-circle' : 'git-compare-outline'}
              label={rec ? 'Cash Variance' : 'Cash Count'}
              value={rec ? `${variance! > 0 ? '+' : ''}${formatTsh(variance!)}` : '—'}
              tint={varianceColor}
            />
            <StatCard
              icon="wallet-outline"
              label="Net Cash Day"
              value={formatTsh(revenue - expenseTotal)}
              tint={colors.sky}
            />
          </View>

          <ReportSection title="Sales performance" icon="trending-up-outline">
            {closing ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Units sold</Text>
                  <Text style={styles.summaryValue}>{closing.items.reduce((s, i) => s + i.sold, 0)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Products in report</Text>
                  <Text style={styles.summaryValue}>{closing.items.length}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Status</Text>
                  <Badge
                    text={closing.status === 'approved' ? 'Approved' : 'Pending review'}
                    color={closing.status === 'approved' ? colors.success : colors.gold}
                    bg={closing.status === 'approved' ? '#E8F5E9' : '#FFF8E1'}
                  />
                </View>
                {closing.items.some((i) => i.sold > 0) && (
                  <>
                    <Text style={styles.subHead}>Top sellers</Text>
                    {[...closing.items]
                      .filter((i) => i.sold > 0)
                      .sort((a, b) => b.revenue - a.revenue)
                      .slice(0, 3)
                      .map((i) => (
                        <View key={i.name} style={styles.topRow}>
                          <Text style={styles.topName} numberOfLines={1}>{i.name}</Text>
                          <Text style={styles.topQty}>{i.sold} sold</Text>
                          <Text style={styles.topRev}>{formatTsh(i.revenue)}</Text>
                        </View>
                      ))}
                  </>
                )}
              </>
            ) : (
              <EmptyState icon="moon-outline" text="No closing submitted for this day yet." />
            )}
          </ReportSection>

          <ReportSection title="Cash reconciliation" icon="scale-outline">
            {rec ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Expected cash</Text>
                  <Text style={styles.summaryValue}>{formatTsh(rec.expectedCash)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Counted in till</Text>
                  <Text style={styles.summaryValue}>{formatTsh(rec.countedCash)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Variance</Text>
                  <Text style={[styles.summaryValue, { color: varianceColor }]}>
                    {rec.variance > 0 ? '+' : ''}{formatTsh(rec.variance)}
                  </Text>
                </View>
                {rec.note && (
                  <View style={styles.miniNote}>
                    <Text style={styles.miniNoteText}>{rec.note}</Text>
                  </View>
                )}
              </>
            ) : (
              <EmptyState icon="wallet-outline" text="No cash count submitted for this day." />
            )}
          </ReportSection>

          <ReportSection title="Expenses of the day" icon="receipt-outline">
            {dayExpenses.length === 0 ? (
              <EmptyState icon="receipt-outline" text="No expenses recorded for this day." />
            ) : (
              dayExpenses.map((e) => (
                <View key={e.id} style={styles.expenseBlock}>
                  <View style={styles.expenseHead}>
                    <Text style={styles.expenseShop}>{e.shopName}</Text>
                    <Text style={styles.expenseTotal}>{formatTsh(e.total)}</Text>
                  </View>
                  {e.items.map((it, i) => (
                    <View key={i} style={styles.expenseRow}>
                      <Text style={styles.expenseDesc} numberOfLines={1}>• {it.description}</Text>
                      <Text style={styles.expenseAmt}>{formatTsh(it.amount)}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ReportSection>
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg, paddingBottom: 60 },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginVertical: spacing.sm,
    },
    stepperBtn: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.pill,
      padding: 8,
    },
    stepperBtnDisabled: {
      backgroundColor: c.surfaceAlt,
      opacity: 0.5,
    },
    stepperLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    muted: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textMuted,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    summaryLabel: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: c.textMuted,
    },
    summaryValue: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    subHead: {
      fontFamily: fonts.headingBold,
      fontSize: 12,
      color: c.text,
      marginTop: spacing.sm,
      marginBottom: 2,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    topName: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: c.text },
    topQty: { fontFamily: fonts.body, fontSize: 11.5, color: c.sky, width: 56, textAlign: 'right' },
    topRev: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: c.gold },
    miniNote: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    miniNoteText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.text,
      lineHeight: 17,
    },
    expenseBlock: {
      marginBottom: spacing.md,
    },
    expenseHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    expenseShop: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.text,
    },
    expenseTotal: {
      fontFamily: fonts.headingBold,
      fontSize: 12.5,
      color: c.danger,
    },
    expenseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: 3,
    },
    expenseDesc: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.textMuted,
    },
    expenseAmt: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: c.text,
    },
  });