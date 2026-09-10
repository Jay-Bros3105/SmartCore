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
import AppWatermark from '../../components/AppWatermark';
import { fonts, radius, spacing } from '../../theme/theme';
import { getCurrentManager, subscribeClosingStock } from '../../services/storeService';
import type { ClosingStock, ManagerProfile } from '../../services/types';
import {
  EmptyState,
  formatDateLabel,
  formatTsh,
  ReportSection,
  shiftDate,
  StatCard,
  todayKey,
} from './ReportShared';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductReport'>;

export default function ProductReportScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [closing, setClosing] = useState<ClosingStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => todayKey());
  const [sort, setSort] = useState<'revenue' | 'sold' | 'name'>('revenue');

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
      unsub = subscribeClosingStock(
        m.branchId,
        (c) => {
          if (!cancelled) setClosing(c);
        },
        () => {},
        date
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [date]);

  const items = useMemo(() => {
    if (!closing) return [];
    const list = [...closing.items];
    if (sort === 'revenue') list.sort((a, b) => b.revenue - a.revenue);
    else if (sort === 'sold') list.sort((a, b) => b.sold - a.sold);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [closing, sort]);

  const totalSold = items.reduce((s, i) => s + i.sold, 0);
  const gross = items.reduce((s, i) => s + i.revenue, 0);
  const soldProducts = items.filter((i) => i.sold > 0).length;

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
      <AppWatermark />
      <ModuleHeader
        title="Product Report"
        subtitle="Sold, remaining and revenue per product"
        onBack={() => navigation.goBack()}
      />
      {renderStepper()}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sky} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? (
            <View style={styles.bigEmpty}>
              <EmptyState icon="cube-outline" text="No closing report for this day yet." />
            </View>
          ) : (
            <>
              <View style={styles.statGrid}>
                <StatCard icon="cart-outline" label="Units sold" value={String(totalSold)} tint={colors.sky} />
                <StatCard icon="checkmark-circle-outline" label="Products sold" value={String(soldProducts)} tint={colors.success} />
                <StatCard icon="cash-outline" label="Gross revenue" value={formatTsh(gross)} tint={colors.gold} />
              </View>

              <ReportSection title="Products" icon="cube-outline">
                <View style={styles.sortRow}>
                  {(
                    [
                      ['revenue', 'Revenue'],
                      ['sold', 'Sold'],
                      ['name', 'Name'],
                    ] as [typeof sort, string][]
                  ).map(([k, label]) => (
                    <Pressable
                      key={k}
                      style={[styles.sortChip, sort === k && { backgroundColor: colors.logoBlueDeep }]}
                      onPress={() => setSort(k)}
                    >
                      <Text style={[styles.sortChipText, sort === k && { color: colors.white }]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.colName]}>Product</Text>
                  <Text style={[styles.th, styles.colNum]}>Sold</Text>
                  <Text style={[styles.th, styles.colNum]}>Remain</Text>
                  <Text style={[styles.th, styles.colNum]}>Revenue</Text>
                </View>
                {items.map((i, idx) => (
                  <View
                    key={i.name}
                    style={[styles.tableRow, { backgroundColor: idx % 2 === 1 ? colors.background : 'transparent' }]}
                  >
                    <Text style={[styles.td, styles.colName]} numberOfLines={1}>{i.name}</Text>
                    <Text style={[styles.td, styles.colNum, { color: colors.sky }]}>{i.sold}</Text>
                    <Text style={[styles.td, styles.colNum]}>{i.remaining}</Text>
                    <Text style={[styles.td, styles.colNum, { color: colors.gold }]}>{formatTsh(i.revenue)}</Text>
                  </View>
                ))}
                <View style={[styles.tableRow, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.td, styles.colName, styles.totalText]}>TOTAL</Text>
                  <Text style={[styles.td, styles.colNum, styles.totalText]}>{totalSold}</Text>
                  <Text style={[styles.td, styles.colNum, styles.totalText]}>
                    {items.reduce((s, i) => s + i.remaining, 0)}
                  </Text>
                  <Text style={[styles.td, styles.colNum, styles.totalText]}>{formatTsh(gross)}</Text>
                </View>
              </ReportSection>
            </>
          )}
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
    },
    bigEmpty: {
      paddingTop: 40,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sortRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: spacing.sm,
    },
    sortChip: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    sortChipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11.5,
      color: c.text,
    },
    tableHead: {
      flexDirection: 'row',
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.sm,
      overflow: 'hidden',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    th: {
      color: c.white,
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    td: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      color: c.text,
    },
    colName: { flex: 1.6, paddingRight: spacing.sm },
    colNum: { flex: 1, textAlign: 'right' },
    totalText: {
      fontFamily: fonts.headingBold,
      fontSize: 12,
      color: c.navy,
    },
  });