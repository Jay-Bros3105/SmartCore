import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ModuleHeader from '../components/ModuleHeader';
import StatusPill from '../components/StatusPill';
import { useTheme } from '../theme/ThemeContext';
import { colors, fonts, radius, spacing } from '../theme/theme';
import {
  getCurrentManager,
  subscribeCurrentStock,
  subscribeOpeningStock,
} from '../services/storeService';
import type { CurrentStock, ManagerProfile, OpeningStock } from '../services/types';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'CurrentStock'>;

export default function CurrentStockScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [current, setCurrent] = useState<CurrentStock | null>(null);
  const [opening, setOpening] = useState<OpeningStock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubCurrent: (() => void) | undefined;
    let unsubOpening: (() => void) | undefined;
    let cancelled = false;
    getCurrentManager()
      .then((m) => {
        if (cancelled) return;
        setManager(m);
        if (m?.branchId) {
          unsubCurrent = subscribeCurrentStock(
            m.branchId,
            (c) => {
              if (cancelled) return;
              setCurrent(c);
              setLoading(false);
            },
            () => {
              if (!cancelled) setLoading(false);
            }
          );
          unsubOpening = subscribeOpeningStock(
            m.branchId,
            (o) => {
              if (cancelled) return;
              setOpening(o);
            },
            () => {}
          );
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
      unsubCurrent?.();
      unsubOpening?.();
    };
  }, []);

  const items = current && current.items.length > 0 ? current.items : opening?.items ?? [];
  const source = current && current.items.length > 0 ? 'current' : 'opening';
  const shopName = current?.shopName ?? opening?.shopName ?? manager?.branchName ?? 'Your Shop';
  const date = current?.date ?? opening?.date;

  const total = items.reduce((s, it) => s + it.qty * it.price, 0);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ModuleHeader title="Current Stock" subtitle="Stock updated by your Admin" onBack={() => navigation.goBack()} />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={[styles.card, { backgroundColor: colors.bg }]}>
              <View style={styles.row}>
                <ActivityIndicator size="small" color={colors.logoBlue} />
                <Text style={[styles.muted, { color: colors.textMuted }]}>
                  Loading current stock…
                </Text>
              </View>
            </View>
          ) : items.length === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.bg }]}>
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.logoBlue}1A` }]}>
                  <Ionicons name="cube-outline" size={18} color={colors.logoBlue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    Current stock not available yet
                  </Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>
                    Confirm your morning opening first, or ask your Admin to add
                    stock on the dashboard.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.bg }]}>
              <View style={styles.hdr}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shopName, { color: colors.text }]}>{shopName}</Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>
                    {date} · {source === 'current' ? 'Updated by your Admin' : 'Same as opening stock'}
                  </Text>
                </View>
                <StatusPill tone="ok" label="Live" />
              </View>

              <View style={[styles.tableHdr, { backgroundColor: colors.border }]}>
                <Text style={[styles.col, styles.colItem, { color: colors.onHeader }]}>Item</Text>
                <Text style={[styles.col, styles.colNum, { color: colors.onHeader }]}>In Stock</Text>
                <Text style={[styles.col, styles.colNum, { color: colors.onHeader }]}>Price</Text>
                <Text style={[styles.col, styles.colNum, { color: colors.onHeader }]}>Total</Text>
              </View>
              {items.map((it, index) => (
                <View
                  key={`${it.name}-${index}`}
                  style={[
                    styles.tableRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: index % 2 === 1 ? colors.bg : undefined,
                    },
                  ]}
                >
                  <Text style={[styles.col, styles.colItem, styles.rowText, { color: colors.text }]} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={[styles.col, styles.colNum, styles.rowText, { color: colors.text }]}>
                    {it.qty}
                  </Text>
                  <Text style={[styles.col, styles.colNum, styles.rowText, { color: colors.text }]}>
                    TSh {it.price.toLocaleString('en-US')}
                  </Text>
                  <Text style={[styles.col, styles.colNum, styles.rowText, { color: colors.text }]}>
                    TSh {(it.qty * it.price).toLocaleString('en-US')}
                  </Text>
                </View>
              ))}
              <View style={[styles.totalRow, { backgroundColor: `${colors.gold}26` }]}>
                <Text style={[styles.col, styles.colItem, styles.totalText, { color: colors.text }]}>
                  TOTAL
                </Text>
                <Text style={[styles.col, styles.colNum, styles.totalText, { color: colors.text }]}>
                  TSh {total.toLocaleString('en-US')}
                </Text>
              </View>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                This is the stock your closing will be measured against. It is the
                same as your opening stock if your Admin hasn't added new items
                mid-day.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 14,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 18,
  },
  hdr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  shopName: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
  },
  tableHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  col: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
  },
  colItem: { flex: 1.8, paddingRight: spacing.sm },
  colNum: { flex: 1, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
  },
  rowText: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.sm,
  },
  totalText: {
    fontFamily: fonts.headingBold,
    fontSize: 13,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: spacing.md,
    lineHeight: 17,
  },
});