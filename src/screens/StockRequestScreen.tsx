import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import AppWatermark from '../components/AppWatermark';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, radius, spacing } from '../theme/theme';
import {
  getCurrentManager,
  getProductsForBranch,
  submitStockRequest,
  type ShopProduct,
} from '../services/storeService';
import type { ManagerProfile, StockRequestItem } from '../services/types';

type Props = NativeStackScreenProps<RootStackParamList, 'StockRequest'>;

function formatTsh(amount: number) {
  return `TSh ${amount.toLocaleString('en-US')}`;
}

type Row = {
  key: string;
  product: ShopProduct;
  qty: string;
};

export default function StockRequestScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentManager().then((m) => {
      if (cancelled) return;
      if (!m?.branchId) {
        setLoading(false);
        return;
      }
      setManager(m);
      getProductsForBranch(m.branchId).then((list) => {
        if (cancelled) return;
        setProducts(list);
        setRows(list.map((p) => ({ key: p.id, product: p, qty: '' })));
        setLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateQty = (key: string, v: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, qty: v.replace(/[^0-9]/g, '') } : r)));
  };

  const visibleRows = useMemo(
    () =>
      search.trim()
        ? rows.filter((r) => r.product.name.toLowerCase().includes(search.trim().toLowerCase()))
        : rows,
    [rows, search]
  );

  const requested = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, amountNum: r.qty === '' ? 0 : Number(r.qty) }))
        .filter((r) => r.amountNum > 0),
    [rows]
  );

  const handleReview = () => {
    if (requested.length === 0) {
      Alert.alert('No Requests Entered', 'Enter a quantity for at least one product you need.');
      return;
    }
    setReviewMode(true);
  };

  const handleSubmit = async () => {
    if (!manager) return;
    setSubmitting(true);
    const items: StockRequestItem[] = requested.map((r) => ({
      name: r.product.name,
      price: r.product.price,
      qty: r.amountNum,
    }));
    const res = await submitStockRequest(manager, items, reason);
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert('Submission Failed', res.message ?? 'Try again.');
      return;
    }
    setSubmittedId(res.docId ?? null);
  };

  const totalUnits = requested.reduce((s, r) => s + r.amountNum, 0);
  const totalValue = requested.reduce((s, r) => s + r.amountNum * r.product.price, 0);

  if (reviewMode && !submittedId) {
    return (
      <View style={styles.flex}>
        <AppWatermark />
        <ModuleHeader
          title="Preview Stock Request"
          subtitle="Check the request before sending to admin"
          onBack={() => setReviewMode(false)}
        />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }}>
          <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
            <View style={styles.tableHead}>
              <Text style={[styles.col, styles.colItem, styles.headText]}>Item</Text>
              <Text style={[styles.col, styles.colNum, styles.headText]}>Price</Text>
              <Text style={[styles.col, styles.colNum, styles.headText]}>Qty</Text>
              <Text style={[styles.col, styles.colNum, styles.headText]}>Value</Text>
            </View>
            {requested.map((r, i) => (
              <View
                key={r.key}
                style={[styles.reviewRow, { backgroundColor: i % 2 === 1 ? colors.background : 'transparent' }]}
              >
                <Text style={[styles.col, styles.colItem, styles.revText]} numberOfLines={1}>{r.product.name}</Text>
                <Text style={[styles.col, styles.colNum, styles.revText]}>{formatTsh(r.product.price)}</Text>
                <Text style={[styles.col, styles.colNum, styles.revText, { color: colors.sky }]}>{r.amountNum}</Text>
                <Text style={[styles.col, styles.colNum, styles.revText]}>{formatTsh(r.amountNum * r.product.price)}</Text>
              </View>
            ))}
            <View style={[styles.reviewRow, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.col, styles.colItem, styles.revTotal]}>TOTAL {totalUnits} units</Text>
              <Text style={[styles.col, styles.colNum, styles.revTotal]}>{formatTsh(totalValue)}</Text>
            </View>
          </View>
          <Text style={styles.reviewHint}>
            The admin will see exactly which products you need and their estimated
            value. Approved requests become a purchase order for your shop.
          </Text>
          <Text style={styles.noteLabel}>Reason for this request (optional)</Text>
          <TextInput
            style={[styles.noteInput, { marginTop: 4 }]}
            placeholder="e.g. Running low after weekend sales…"
            placeholderTextColor={colors.textMuted}
            value={reason}
            onChangeText={setReason}
          />
        </ScrollView>
        <View style={[styles.submitBar, { bottom: insets.bottom }]}>
          <Pressable style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting…' : 'Send Request to Admin'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (submittedId) {
    return (
      <View style={styles.flex}>
        <AppWatermark />
        <ModuleHeader
          title="Request Stock"
          subtitle="Send a request to Admin"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerWrap}>
          <View style={[styles.successIcon, { backgroundColor: colors.sky }]}>
            <Ionicons name="paper-plane" size={32} color={colors.white} />
          </View>
          <Text style={styles.successTitle}>Request Submitted</Text>
          <Text style={styles.successBody}>
            {requested.length} product{requested.length === 1 ? '' : 's'} · {totalUnits} units ·{' '}
            {formatTsh(totalValue)}
            {'\n'}Your admin has received the list and will confirm it soon.
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
      <AppWatermark />
      <ModuleHeader
        title="Request Stock"
        subtitle="Send a request to Admin"
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sky} />
          <Text style={styles.mutedText}>Loading this shop's products…</Text>
        </View>
      ) : (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search product…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.logoBlue} />
            <Text style={styles.noticeText}>
              Enter how many units you need of each product. The request goes straight
              to your admin with estimated value.
            </Text>
          </View>
          <FlatList
            style={styles.body}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
            data={visibleRows}
            keyExtractor={(r) => r.key}
            ListHeaderComponent={
              <View style={styles.headerRow}>
                <Text style={[styles.hl, { flex: 1.6 }]}>Item</Text>
                <Text style={[styles.hl, { width: 62, textAlign: 'right' }]}>Price</Text>
                <Text style={[styles.hl, { width: 58, textAlign: 'center' }]}>Request</Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.centerWrap}>
                <Text style={styles.mutedText}>No products found.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const amountNum = item.qty === '' ? 0 : Number(item.qty);
              return (
                <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}>
                  <View style={{ flex: 1.6 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.itemPrice}>{formatTsh(item.product.price)}</Text>
                  </View>
                  <Text style={[styles.itemValue, { width: 62, textAlign: 'right' }]}>
                    {formatTsh(amountNum * item.product.price)}
                  </Text>
                  <TextInput
                    style={styles.qtyInput}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={item.qty}
                    onChangeText={(v) => updateQty(item.key, v)}
                  />
                </View>
              );
            }}
          />
          {requested.length > 0 && (
            <View style={styles.recapChip}>
              <Ionicons name="send" size={16} color={colors.white} />
              <Text style={styles.recapChipText}>
                {requested.length} item{requested.length === 1 ? '' : 's'} · {totalUnits} units · {formatTsh(totalValue)}
              </Text>
            </View>
          )}
          <View style={[styles.submitBar, { bottom: insets.bottom }]}>
            <Pressable style={styles.submitBtn} onPress={handleReview}>
              <Text style={styles.submitBtnText}>Preview Request →</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    body: { flex: 1 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.sm,
    },
    hl: {
      color: c.white,
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      backgroundColor: c.bg,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 2,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.text,
      paddingVertical: 10,
    },
    noticeCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    noticeText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.textMuted,
      lineHeight: 17,
    },
    card: {
      backgroundColor: c.bg,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    itemName: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    itemPrice: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11.5,
      color: c.gold,
      marginTop: 2,
    },
    itemValue: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11.5,
      color: c.textMuted,
    },
    qtyInput: {
      width: 58,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      fontFamily: fonts.headingBold,
      fontSize: 16,
      color: c.text,
      textAlign: 'center',
    },
    recapChip: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      bottom: 110,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.pill,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
    },
    recapChipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.white,
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
    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.logoBlueDeep,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
    },
    headText: {
      color: c.white,
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
    },
    col: { fontFamily: fonts.body, fontSize: 11.5 },
    colItem: { flex: 1.6, paddingRight: spacing.sm },
    colNum: { flex: 1, textAlign: 'right' },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 1,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    revText: { color: c.text },
    revTotal: { fontFamily: fonts.headingBold, fontSize: 12.5, color: c.navy },
    reviewHint: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: c.textMuted,
      lineHeight: 17,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    noteLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      color: c.text,
    },
    noteInput: {
      backgroundColor: c.bg,
      borderRadius: radius.md,
      padding: spacing.md,
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.text,
      minHeight: 60,
      borderWidth: 1,
      borderColor: c.border,
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
      lineHeight: 19,
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
  });