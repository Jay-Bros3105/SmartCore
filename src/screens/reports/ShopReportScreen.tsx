import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  getCurrentManager,
  getProductsForBranch,
  subscribeCurrentStock,
  subscribeClosingStock,
  type ShopProduct,
} from '../../services/storeService';
import type { ClosingStock, CurrentStock, ManagerProfile } from '../../services/types';
import { shareClosingSalesPdf } from '../../utils/stockPdf';
import { EmptyState, formatTsh, ReportSection, StatCard, todayKey } from './ReportShared';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopReport'>;

function countLowStock(items: { name: string; qty: number; price: number }[], products: ShopProduct[]) {
  const threshold = 3;
  const map = new Map(items.map((i) => [i.name, i]));
  const list: { name: string; qty: number; price: number }[] = [];
  for (const p of products) {
    const cur = map.get(p.name);
    const qty = cur?.qty ?? 0;
    if (qty <= threshold) list.push({ name: p.name, qty, price: p.price });
  }
  return list;
}

export default function ShopReportScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [stock, setStock] = useState<CurrentStock | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [closing, setClosing] = useState<ClosingStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let c1: (() => void) | undefined;
    let c2: (() => void) | undefined;
    let c3: (() => void) | undefined;
    const date = todayKey();
    getCurrentManager().then((m) => {
      if (cancelled) return;
      if (!m?.branchId) {
        setLoading(false);
        return;
      }
      setManager(m);
      c1 = subscribeCurrentStock(
        m.branchId,
        (s) => { if (!cancelled) setStock(s); },
        () => {},
        date
      );
      c2 = subscribeClosingStock(
        m.branchId,
        (c) => { if (!cancelled) setClosing(c); },
        () => {},
        date
      );
      getProductsForBranch(m.branchId).then((list) => {
        if (!cancelled) setProducts(list);
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
      c1?.();
      c2?.();
      c3?.();
    };
  }, []);

  const items = stock?.items ?? [];
  const inStockUnits = items.reduce((s, i) => s + i.qty, 0);
  const stockValue = items.reduce((s, i) => s + i.qty * i.price, 0);
  const low = countLowStock(items, products);
  const todayRev = closing?.totalRevenue ?? 0;

  const handlePdf = async () => {
    if (!closing) return;
    setPdfBusy(true);
    try {
      const res = await shareClosingSalesPdf({ closing, managerName: manager?.fullName });
      if (!res.ok) Alert.alert('PDF Failed', res.message);
    } catch (e) {
      Alert.alert('PDF Failed', e instanceof Error ? e.message : 'Could not create the PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <AppWatermark />
      <ModuleHeader
        title="Shop Report"
        subtitle={`${manager?.branchName ?? 'Your shop'} · today`}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sky} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statGrid}>
            <StatCard icon="layers-outline" label="Products" value={String(items.length)} tint={colors.sky} />
            <StatCard icon="cube-outline" label="Units in stock" value={String(inStockUnits)} tint={colors.navy} />
            <StatCard icon="pricetag-outline" label="Stock value" value={formatTsh(stockValue)} tint={colors.navy} />
            <StatCard icon="trending-up-outline" label="Today's sales" value={formatTsh(todayRev)} tint={colors.success} />
          </View>

          <ReportSection title="Low stock alert" icon="alert-circle-outline">
            {low.length === 0 ? (
              <EmptyState icon="checkmark-circle-outline" text="No product is running low. Stock health is good." />
            ) : (
              low.map((i) => (
                <View key={i.name} style={styles.lowRow}>
                  <View style={styles.lowDot} />
                  <Text style={styles.lowName} numberOfLines={1}>{i.name}</Text>
                  <Text style={[styles.lowQty, { color: colors.danger }]}>{i.qty} left</Text>
                  <Text style={styles.lowPrice}>{formatTsh(i.price)}</Text>
                </View>
              ))
            )}
          </ReportSection>

          <ReportSection title="Stock list" icon="list-outline">
            {items.length === 0 ? (
              <EmptyState text="No current stock yet — confirm this morning's opening." />
            ) : (
              items.map((i, idx) => (
                <View
                  key={i.name}
                  style={[styles.stockRow, idx !== items.length - 1 && styles.hairline]}
                >
                  <Text style={styles.stockName} numberOfLines={1}>{i.name}</Text>
                  <Badge2 text={`${i.qty} units`} />
                  <Text style={styles.stockPrice}>{formatTsh(i.qty * i.price)}</Text>
                </View>
              ))
            )}
          </ReportSection>

          {closing && (
            <Pressable style={styles.pdfBtn} onPress={handlePdf} disabled={pdfBusy}>
              <Ionicons name="download-outline" size={18} color="#1a1305" />
              <Text style={styles.pdfBtnText}>
                {pdfBusy ? 'Creating PDF…' : 'Download Sales Report PDF'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const Badge2 = ({ text }: { text: string }) => {
  const { colors } = useTheme();
  return (
    <View style={[stylesBadge2.pill, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[stylesBadge2.text, { color: colors.text }]}>{text}</Text>
    </View>
  );
};

const stylesBadge2 = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  text: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10.5,
  },
});

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg, paddingBottom: 60 },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    lowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    lowDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.danger,
    },
    lowName: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    lowQty: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      width: 52,
      textAlign: 'right',
    },
    lowPrice: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: c.gold,
      width: 70,
      textAlign: 'right',
    },
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 8,
    },
    hairline: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    stockName: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: c.text,
    },
    stockPrice: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.navy,
      width: 80,
      textAlign: 'right',
    },
    pdfBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.gold,
      borderRadius: radius.md,
      paddingVertical: 14,
      marginBottom: spacing.sm,
    },
    pdfBtnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13.5,
      color: '#1a1305',
    },
  });