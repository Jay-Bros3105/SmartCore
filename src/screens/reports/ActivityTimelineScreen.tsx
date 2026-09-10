import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  getCashReconciliationsForBranch,
  getClosingReportsForBranch,
  getCurrentManager,
  getExpensesForBranch,
  getOpeningsForBranch,
  getReceivingForBranch,
  getRequestsForBranch,
} from '../../services/storeService';
import type { ClosingStock, ExpenseSubmission, ManagerProfile, OpeningStock, StockReceiving, StockRequest, CashReconciliation } from '../../services/types';
import { formatTsh } from './ReportShared';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityTimeline'>;

type Event = {
  id: string;
  date: string;
  time?: string;
  type:
    | 'opening'
    | 'closing'
    | 'receiving'
    | 'request'
    | 'expenses'
    | 'cash';
  title: string;
  subtitle: string;
  status: string;
  tint: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const TYPE_META: Record<Event['type'], { icon: React.ComponentProps<typeof Ionicons>['name']; tint: string }> = {
  opening: { icon: 'sunny-outline', tint: '#C9A227' },
  closing: { icon: 'moon-outline', tint: '#146B78' },
  receiving: { icon: 'cube-outline', tint: '#2E7D32' },
  request: { icon: 'send-outline', tint: '#2BB6C9' },
  expenses: { icon: 'receipt-outline', tint: '#C62828' },
  cash: { icon: 'wallet-outline', tint: '#146B78' },
};

function timeOf(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function ActivityTimelineScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentManager().then(async (m) => {
      if (cancelled) return;
      if (!m?.branchId) {
        setLoading(false);
        return;
      }
      setManager(m);
      try {
        const [closings, openings, receiving, requests, recs, exps] = await Promise.all([
          getClosingReportsForBranch(m.branchId),
          getOpeningsForBranch(m.branchId),
          getReceivingForBranch(m.branchId),
          getRequestsForBranch(m.branchId),
          getCashReconciliationsForBranch(m.branchId),
          getExpensesForBranch(m.branchId),
        ]);
        if (cancelled) return;
        const all: Event[] = [];
        for (const c of closings as ClosingStock[]) {
          all.push({
            id: 'closing-' + c.id,
            date: c.date,
            time: timeOf(c.submittedAt),
            type: 'closing',
            title: 'Daily closing',
            subtitle: `${c.items.reduce((s, i) => s + i.sold, 0)} units sold · ${formatTsh(c.totalRevenue)}`,
            status: c.status === 'approved' ? 'Approved' : 'Pending',
            tint: TYPE_META.closing.tint,
            icon: TYPE_META.closing.icon,
          });
        }
        for (const o of openings as OpeningStock[]) {
          const confirmed = o.status === 'confirmed' || o.status === 'sent';
          all.push({
            id: 'opening-' + o.id,
            date: o.date,
            type: 'opening',
            title: confirmed ? 'Opening stock confirmed' : 'Opening stock generated',
            subtitle: `${o.items.length} products · ${o.items.reduce((s, i) => s + i.qty, 0)} units`,
            status: confirmed ? 'Confirmed' : 'Generated',
            tint: TYPE_META.opening.tint,
            icon: TYPE_META.opening.icon,
          });
        }
        for (const r of receiving as StockReceiving[]) {
          all.push({
            id: 'receiving-' + r.id,
            date: r.date,
            time: timeOf(r.submittedAt),
            type: 'receiving',
            title: 'Stock received',
            subtitle: `${r.items.reduce((s, i) => s + i.qty, 0)} units · ${formatTsh(r.total)}`,
            status: r.status === 'approved' ? 'Approved' : 'Pending',
            tint: TYPE_META.receiving.tint,
            icon: TYPE_META.receiving.icon,
          });
        }
        for (const q of requests as StockRequest[]) {
          all.push({
            id: 'request-' + q.id,
            date: q.date,
            time: timeOf(q.submittedAt),
            type: 'request',
            title: 'Stock request',
            subtitle: `${q.items.length} products · ${formatTsh(q.items.reduce((s, i) => s + i.qty * i.price, 0))}${q.reason ? ` · ${q.reason}` : ''}`,
            status: q.status === 'approved' ? 'Approved' : 'Pending',
            tint: TYPE_META.request.tint,
            icon: TYPE_META.request.icon,
          });
        }
        for (const rc of recs as CashReconciliation[]) {
          all.push({
            id: 'cash-' + rc.id,
            date: rc.date,
            time: timeOf(rc.submittedAt),
            type: 'cash',
            title: 'Cash reconciliation',
            subtitle: `${formatTsh(rc.expectedCash)} expected · counted ${formatTsh(rc.countedCash)}`,
            status:
              rc.status === 'approved' ? 'Approved' : rc.varianceKind === 'matched' ? 'Pending' : `${rc.varianceKind[0].toUpperCase()}${rc.varianceKind.slice(1)}`,
            tint: TYPE_META.cash.tint,
            icon: TYPE_META.cash.icon,
          });
        }
        for (const e of exps as ExpenseSubmission[]) {
          all.push({
            id: 'expenses-' + e.id,
            date: e.date,
            time: timeOf(e.submittedAt),
            type: 'expenses',
            title: 'Expenses recorded',
            subtitle: `${e.items.length} item${e.items.length === 1 ? '' : 's'} · ${formatTsh(e.total)}`,
            status: e.status === 'approved' ? 'Approved' : 'Pending',
            tint: TYPE_META.expenses.tint,
            icon: TYPE_META.expenses.icon,
          });
        }
        all.sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
        setEvents(all);
      } catch {
        // no-op
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()];
  }, [events]);

  const statusColor = (status: string) => {
    if (status === 'Approved' || status === 'Confirmed' || status === 'Matched') return colors.success;
    if (status === 'Shortage') return colors.danger;
    return colors.gold;
  };

  return (
    <View style={styles.flex}>
      <AppWatermark />
      <ModuleHeader
        title="Shop Activity Timeline"
        subtitle={`${manager?.branchName ?? 'Your shop'} · every event in order`}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sky} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {events.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={28} color={colors.sky} />
              </View>
              <Text style={styles.emptyText}>
                No activity recorded yet. Once you open, receive, request, close or
                count cash, everything will appear here in order.
              </Text>
            </View>
          ) : (
            byDay.map(([date, list]) => (
              <View key={date} style={styles.dayBlock}>
                <Text style={styles.dayTitle}>{date}</Text>
                <View style={styles.timeline}>
                  {list.map((e, i) => (
                    <View key={e.id} style={[styles.eventRow, i === list.length - 1 && { borderLeftWidth: 0 }]}>
                      <View style={[styles.dot, { backgroundColor: e.tint }]}>
                        <Ionicons name={e.icon} size={12} color={colors.white} />
                      </View>
                      <View style={styles.eventCard}>
                        <View style={styles.eventTop}>
                          <Text style={styles.eventTitle}>{e.title}</Text>
                          {e.time ? <Text style={styles.eventTime}>{e.time}</Text> : null}
                        </View>
                        <Text style={styles.eventSubtitle}>{e.subtitle}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor(e.status)}1A` }]}>
                          <Text style={[styles.statusText, { color: statusColor(e.status) }]}>{e.status}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
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
    dayBlock: {
      marginBottom: spacing.lg,
    },
    dayTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 13,
      color: c.text,
      marginBottom: spacing.sm,
    },
    timeline: {
      borderLeftWidth: 2,
      borderLeftColor: c.border,
      paddingLeft: spacing.lg - 6,
    },
    eventRow: {
      position: 'relative',
      marginBottom: spacing.md,
    },
    dot: {
      position: 'absolute',
      left: -(spacing.lg - 6) - 11,
      top: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventCard: {
      backgroundColor: c.bg,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    eventTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eventTitle: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    eventTime: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
    },
    eventSubtitle: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.textMuted,
      lineHeight: 17,
      marginTop: 2,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      marginTop: 6,
    },
    statusText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });