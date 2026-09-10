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
import { getClosingReportsForBranch, getCurrentManager } from '../../services/storeService';
import type { ClosingStock, ManagerProfile } from '../../services/types';
import {
  Badge,
  EmptyState,
  formatDateShort,
  formatTsh,
  ReportSection,
  shiftDate,
  StatCard,
  todayKey,
} from './ReportShared';

type Props = NativeStackScreenProps<RootStackParamList, 'PeriodReport'>;

export default function PeriodReportScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [reports, setReports] = useState<ClosingStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    let cancelled = false;
    getCurrentManager().then((m) => {
      if (cancelled) return;
      if (!m?.branchId) {
        setLoading(false);
        return;
      }
      setManager(m);
      getClosingReportsForBranch(m.branchId).then((list) => {
        if (cancelled) return;
        setReports(list);
        setLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const inRange = useMemo(() => {
    const today = todayKey();
    const cutoff = shiftDate(today, range === '7d' ? -6 : -29);
    return reports.filter((r) => r.date >= cutoff && r.date <= today);
  }, [reports, range]);

  const approved = inRange.filter((r) => r.status === 'approved');
  const totalRevenue = approved.reduce((s, r) => s + r.totalRevenue, 0);
  const totalSold = approved.reduce((s, r) => s + r.items.reduce((x, i) => x + i.sold, 0), 0);
  const avgDay = approved.length ? Math.round(totalRevenue / approved.length) : 0;

  const best = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const r of approved) {
      for (const i of r.items) {
        const cur = map.get(i.name) ?? { qty: 0, revenue: 0 };
        cur.qty += i.sold;
        cur.revenue += i.revenue;
        map.set(i.name, cur);
      }
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .filter((v) => v.qty > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [approved]);

  const bestCount = best.length ? best[0].qty : 0;

  return (
    <View style={styles.flex}>
      <AppWatermark />
      <ModuleHeader
        title="Weekly & Monthly Report"
        subtitle="Performance trends for your shop"
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sky} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.rangeRow}>
            <Pressable
              style={[styles.rangeChip, range === '7d' && { backgroundColor: colors.logoBlueDeep }]}
              onPress={() => setRange('7d')}
            >
              <Text style={[styles.rangeChipText, range === '7d' && { color: colors.white }]}>Last 7 days</Text>
            </Pressable>
            <Pressable
              style={[styles.rangeChip, range === '30d' && { backgroundColor: colors.logoBlueDeep }]}
              onPress={() => setRange('30d')}
            >
              <Text style={[styles.rangeChipText, range === '30d' && { color: colors.white }]}>Last 30 days</Text>
            </Pressable>
          </View>

          <View style={styles.statGrid}>
            <StatCard icon="trending-up-outline" label="Total revenue" value={formatTsh(totalRevenue)} tint={colors.success} />
            <StatCard icon="cart-outline" label="Units sold" value={String(totalSold)} tint={colors.sky} />
            <StatCard icon="calendar-outline" label={`Days reported (${range})`} value={String(approved.length)} tint={colors.navy} />
            <StatCard icon="pulse-outline" label="Avg daily sales" value={formatTsh(avgDay)} tint={colors.gold} />
          </View>

          <ReportSection title="Best products" icon="trophy-outline">
            {best.length === 0 ? (
              <EmptyState icon="trophy-outline" text="No sales data in this period yet." />
            ) : (
              best.slice(0, 5).map((p, i) => (
                <View key={p.name} style={styles.bestRow}>
                  <View style={[styles.rank, { backgroundColor: i === 0 ? colors.gold : colors.surfaceAlt }]}>
                    <Text style={[styles.rankText, { color: i === 0 ? '#1a1305' : colors.textMuted }]}>{i + 1}</Text>
                  </View>
                  <Text style={styles.bestName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.bestQty}>{p.qty} sold</Text>
                  <Text style={styles.bestRev}>{formatTsh(p.revenue)}</Text>
                </View>
              ))
            )}
          </ReportSection>

          <ReportSection title="Day by day" icon="calendar-outline">
            {inRange.length === 0 ? (
              <EmptyState text="No closings submitted in this period." />
            ) : (
              inRange.map((r) => (
                <View key={r.id} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{formatDateShort(r.date)}</Text>
                  <Badge
                    text={r.status === 'approved' ? 'Approved' : 'Pending'}
                    color={r.status === 'approved' ? colors.success : colors.gold}
                    bg={r.status === 'approved' ? '#E8F5E9' : '#FFF8E1'}
                  />
                  <Text style={styles.dayUnits}>{r.items.reduce((s, i) => s + i.sold, 0)} units</Text>
                  <Text style={styles.dayRev}>{formatTsh(r.totalRevenue)}</Text>
                </View>
              ))
            )}
          </ReportSection>

          {best.length > 0 && (
            <View style={styles.insight}>
              <Ionicons name="bulb-outline" size={18} color={colors.gold} />
              <Text style={styles.insightText}>
                Your top seller is <Text style={{ fontWeight: '700', color: colors.navy }}>{best[0].name}</Text> with{' '}
                {bestCount} units and {formatTsh(best[0].revenue)} in revenue{range === '7d' ? '' : ' this month'}.
              </Text>
            </View>
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
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rangeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: spacing.md,
    },
    rangeChip: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    rangeChipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      color: c.text,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    bestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rank: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      fontFamily: fonts.headingBold,
      fontSize: 12,
    },
    bestName: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    bestQty: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      color: c.sky,
      width: 56,
      textAlign: 'right',
    },
    bestRev: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.gold,
      width: 84,
      textAlign: 'right',
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    dayLabel: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.text,
    },
    dayUnits: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      color: c.textMuted,
      width: 56,
      textAlign: 'right',
    },
    dayRev: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.navy,
      width: 84,
      textAlign: 'right',
    },
    insight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.gold + '22',
      borderRadius: radius.md,
      padding: spacing.md,
    },
    insightText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: c.textMuted,
      lineHeight: 18,
    },
  });