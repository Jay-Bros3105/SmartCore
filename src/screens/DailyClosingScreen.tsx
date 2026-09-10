import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/RootNavigator';
import ModuleHeader from '../components/ModuleHeader';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';
import AppWatermark from '../components/AppWatermark';
import { fonts, radius, spacing } from '../theme/theme';
import {
  getCurrentManager,
  getDayMoneyOut,
  subscribeClosingStock,
  subscribeLatestCurrentStock,
  subscribeOpeningStock,
  submitClosingStock,
} from '../services/storeService';
import type { ClosingStock, ManagerProfile, OpeningStock } from '../services/types';
import { shareClosingSalesPdf } from '../utils/stockPdf';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyClosing'>;

type Row = {
  key: string;
  name: string;
  current: number;
  price: number;
  remaining: string;
};

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

export default function DailyClosingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState<ClosingStock | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [date, setDate] = useState(() => todayKey());
  const [nextOpening, setNextOpening] = useState<OpeningStock | null>(null);
  const [unlockNext, setUnlockNext] = useState(false);
  const [search, setSearch] = useState('');
  const [blockedOnOpening, setBlockedOnOpening] = useState(false);
  const [missingModalOpen, setMissingModalOpen] = useState(false);
  const [moneyOut, setMoneyOut] = useState({ expenses: 0, receiving: 0, request: 0, total: 0 });
  const [expensesConfirmed, setExpensesConfirmed] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);

  const refreshMoneyOut = useCallback(() => {
    const branchId = manager?.branchId;
    if (!branchId) return;
    getDayMoneyOut(branchId, date).then((mo) => setMoneyOut(mo));
  }, [manager?.branchId, date]);

  // Kila skrini ikifa macho (mchunguzi kurudi kutoka Expenses), soma upya money out —
  // expenses zilizoandikwa sasa hivi zionekane mara moja kwenye "Expenses (today)".
  useFocusEffect(
    useCallback(() => {
      refreshMoneyOut();
    }, [refreshMoneyOut])
  );

  const resetForNextDay = () => {
    setClosing(null);
    setReviewMode(false);
    setRows([]);
    setLoading(true);
    setNextOpening(null);
    setMoneyOut({ expenses: 0, receiving: 0, request: 0, total: 0 });
    setExpensesConfirmed(false);
    setDate(shiftDate(date, 1));
  };

  const handleDone = () => {
    if (date < todayKey()) {
      setUnlockNext(false);
      setDate(todayKey());
      return;
    }
    setUnlockNext(false);
    resetForNextDay();
  };

  const handleContinueNext = () => {
    if (nextOpening && nextOpening.status === 'confirmed') {
      setUnlockNext(true);
      setBlockedOnOpening(false);
      resetForNextDay();
      return;
    }
    setBlockedOnOpening(true);
  };

  // Opening ikithibitishwa na msimamizi (Shop Opening), ondosha lango moja kwa moja.
  useEffect(() => {
    if (nextOpening?.status === 'confirmed') {
      setBlockedOnOpening(false);
    }
  }, [nextOpening]);

  // Wakati closing ipo imeapproved: subskribe opening ya kesho (kwa button Done).
  useEffect(() => {
    if (!manager?.branchId || closing?.status !== 'approved') {
      setNextOpening(null);
      return;
    }
    const next = shiftDate(date, 1);
    let advanced = false;
    const unsub = subscribeOpeningStock(
      manager.branchId,
      (o) => {
        setNextOpening(o);
        if (o?.status === 'confirmed') {
          setUnlockNext(true);
          setBlockedOnOpening(false);
        }
        // Tarehe ya leo ikisha-fungwa NA opening ya kesho ikithaibitishwa →
        // anza mwanzo kesho moja kwa moja, bila kusubiri "Done".
        if (!advanced && o?.status === 'confirmed' && date === todayKey()) {
          advanced = true;
          resetForNextDay();
        }
      },
      () => setNextOpening(null),
      next
    );
    return unsub;
  }, [manager?.branchId, closing?.status, date]);

  const handleDownloadPdf = async () => {
    if (!closing) return;
    setPdfBusy(true);
    try {
      const res = await shareClosingSalesPdf({
        closing: closing,
        managerName: manager?.fullName,
      });
      if (!res.ok) Alert.alert('PDF Failed', res.message);
    } catch (e) {
      Alert.alert(
        'PDF Failed',
        e instanceof Error ? e.message : 'Could not create the PDF. Please try again.'
      );
    } finally {
      setPdfBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let unsubClosing: (() => void) | undefined;
    let unsubCurrent: (() => void) | undefined;

    // Hakikisha hali inaanzia upya kwa tarehe husika — si reference ya tarehe ya nyuma.
    setClosing(null);
    setReviewMode(false);

    getCurrentManager()
      .then((m) => {
        if (cancelled) return;
        if (!m?.branchId) {
          setLoading(false);
          return;
        }
        setManager(m);
        getDayMoneyOut(m.branchId, date).then((mo) => {
          if (!cancelled) setMoneyOut(mo);
        });
        unsubClosing = subscribeClosingStock(
          m.branchId,
          (c) => {
            if (!cancelled) setClosing(c);
          },
          () => {},
          date
        );
        // REFERENCE YA DAILY CLOSING = CURRENT STOCK PEKEE (ile iliyopo SASA kwa admin).
        // Hakuna fallback kwenye opening. Inasoma "current stock ya session ya mwisho"
        // ili pill ya Current ihakikiwe na current iliyopo — hata kama session ina
        // tarehe tofauti (mauzo yanaweza kufunguliwa > mara 2 kwa siku).
        unsubCurrent = subscribeLatestCurrentStock(
          m.branchId,
          (stk) => {
            if (cancelled) return;
            const items = stk?.items ?? [];
            setRows(
              items.map((it, i) => ({
                key: `${it.name}-${i}`,
                name: it.name,
                current: it.qty,
                price: it.price,
                remaining: '',
              }))
            );
            setLoading(false);
          },
          () => {}
        );
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubClosing?.();
      unsubCurrent?.();
    };
  }, [date]);

  const updateRemaining = (key: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, remaining: value } : r)));
  };

  const computedRows = useMemo(
    () =>
      rows.map((r) => {
        const remainingRaw = r.remaining === '' ? null : Number(r.remaining);
        const sold = remainingRaw === null ? 0 : Math.max(0, r.current - remainingRaw);
        const revenue = remainingRaw === null ? 0 : sold * r.price;
        return { ...r, remainingNum: remainingRaw, sold, revenue };
      }),
    [rows]
  );

  const totalRevenue = computedRows.reduce((s, r) => s + r.revenue, 0);
  const anyOver = computedRows.some((r) => r.remainingNum !== null && r.remainingNum > r.current);

  const today = todayKey();
  const isFuture = date > today && !unlockNext;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const missingRows = useMemo(() => rows.filter((r) => r.remaining === ''), [rows]);

  const validateAll = (): boolean => {
    if (rows.some((r) => r.remaining === '')) {
      setMissingModalOpen(true);
      return false;
    }
    if (anyOver) {
      Alert.alert(
        'Quantity Too High',
        'Remaining quantity cannot exceed the current stock for any item. Adjust it to continue.'
      );
      return false;
    }
    return true;
  };

  const goToFirstMissing = () => {
    setMissingModalOpen(false);
    setSearch('');
    const index = rows.findIndex((r) => r.remaining === '');
    if (index >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
      }, 200);
    }
  };

  const handleReview = () => {
    if (!validateAll()) return;
    refreshMoneyOut();
    setReviewMode(true);
  };

  const handleSubmit = async () => {
    if (!manager) return;
    setSubmitting(true);
    const res = await submitClosingStock(
      manager,
      computedRows.map((r) => ({
        name: r.name,
        current: r.current,
        price: r.price,
        remaining: r.remainingNum as number,
      })),
      date,
      {
        expensesConfirmed,
        expensesTotal: moneyOut.expenses,
        receivingTotal: moneyOut.receiving,
        requestTotal: moneyOut.request,
        moneyOut: moneyOut.expenses,
      }
    );
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert('Submission Failed', res.message ?? 'Try again.');
      return;
    }
    const created: ClosingStock = {
      id: res.docId ?? `${manager.branchId}_${date}`,
      shopId: manager.branchId,
      shopName: manager.branchName,
      date,
      items: computedRows.map((r) => ({
        name: r.name,
        current: r.current,
        price: r.price,
        remaining: r.remainingNum as number,
        sold: r.sold,
        revenue: r.revenue,
      })),
      totalRevenue,
      status: 'pending_admin',
      managerName: manager.fullName,
      submittedAt: new Date().toISOString(),
      expensesConfirmed,
      moneyOutExpenses: moneyOut.expenses,
      moneyOutReceiving: moneyOut.receiving,
      moneyOutRequest: moneyOut.request,
      moneyOutTotal: moneyOut.total,
    };
    setReviewMode(false);
    setClosing(created);
  };

  const submitted = !!closing;

  const renderDateStepper = () => {
    const canForward = date < today;
    return (
      <View style={styles.dateStepper}>
        <Pressable style={styles.dateStepperBtn} onPress={() => { setUnlockNext(false); setDate(shiftDate(date, -1)); }} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.sky} />
        </Pressable>
        <Text style={styles.dateStepperLabel}>Closing for · {formatDateLabel(date)}</Text>
        {date !== today ? (
          <Pressable style={styles.todayBtn} onPress={() => { setUnlockNext(false); setDate(today); }} hitSlop={8}>
            <Text style={styles.todayBtnText}>Today</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.dateStepperBtn, !canForward && styles.dateStepperBtnDisabled]}
            disabled={!canForward}
            onPress={() => { setUnlockNext(false); setDate(shiftDate(date, 1)); }}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={18} color={canForward ? colors.sky : colors.border} />
          </Pressable>
        )}
      </View>
    );
  };

  const renderSubmitted = () => (
    <View style={styles.centerWrap}>
      <View style={[styles.successIcon, { backgroundColor: colors.gold }]}>
        <Ionicons name="checkmark" size={34} color={colors.white} />
      </View>
      <Text style={styles.successTitle}>Closing Submitted</Text>
      <Text style={styles.successBody}>
        Waiting Admin's Approval. It stays locked here until your admin approves it.
      </Text>
      <Pressable
        style={[styles.pdfBtn, pdfBusy && { opacity: 0.6 }]}
        disabled={pdfBusy}
        onPress={handleDownloadPdf}
      >
        <Ionicons name="download-outline" size={18} color="#1a1305" />
        <Text style={styles.pdfBtnText}>
          {pdfBusy ? 'Creating PDF…' : 'Download PDF · Sales Report'}
        </Text>
      </Pressable>
      <Text style={styles.pdfHint}>Share this sales report to your Admin via WhatsApp.</Text>
      <Pressable style={styles.doneBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.doneBtnText}>Back to Home</Text>
      </Pressable>
    </View>
  );

  const renderApproved = () => (
    <View style={styles.centerWrap}>
      <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
        <Ionicons name="checkmark-done" size={34} color={colors.white} />
      </View>
      <Text style={styles.successTitle}>Closing Approved</Text>
      <Text style={styles.successBody}>
        Your closing has been approved by your admin.
      </Text>
      <Pressable style={styles.doneBtn} onPress={handleContinueNext}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </View>
  );

  // REVIEW MODE — onyesha kila kitu kabla ya submit + PDF
  if (reviewMode && !submitted) {
    return (
      <View style={styles.flex}>
        <AppWatermark />
        <ModuleHeader
          title="Review Sales Data"
          subtitle="Check everything before submitting"
          onBack={() => setReviewMode(false)}
        />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
          <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
            <View style={styles.tableHead}>
              <Text style={[styles.col, styles.colItem, styles.headText]}>Item</Text>
              <Text style={[styles.col, styles.colNum, styles.headText]}>Opening</Text>
              <Text style={[styles.col, styles.colNum, styles.headText]}>Sold</Text>
              <Text style={[styles.col, styles.colNum, styles.headText]}>Remain</Text>
              <Text style={[styles.col, styles.colNum, styles.headText]}>Rev.</Text>
            </View>
            {computedRows.map((r, i) => (
              <View
                key={r.key}
                style={[styles.reviewRow, { backgroundColor: i % 2 === 1 ? colors.background : 'transparent' }]}
              >
                <Text style={[styles.col, styles.colItem, styles.revText]} numberOfLines={1}>{r.name}</Text>
                <Text style={[styles.col, styles.colNum, styles.revText]}>{r.current}</Text>
                <Text style={[styles.col, styles.colNum, styles.revText, { color: colors.sky }]}>
                  {r.sold}
                </Text>
                <Text style={[styles.col, styles.colNum, styles.revText]}>{r.remainingNum}</Text>
                <Text style={[styles.col, styles.colNum, styles.revText]}>{formatTsh(r.revenue)}</Text>
              </View>
            ))}
            <View style={[styles.reviewRow, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.col, styles.colItem, styles.revTotal]}>TOTAL REVENUE</Text>
              <Text style={[styles.col, styles.colNum, styles.revTotal]}>{formatTsh(totalRevenue)}</Text>
            </View>
          </View>
          <Text style={styles.reviewHint}>
            New stock items received today are included in sales.
          </Text>

          <View style={[styles.card, { marginTop: spacing.md, backgroundColor: colors.surfaceAlt }]}>
            <Text style={styles.closeTitle}>DAY'S TOTAL TO CLOSE</Text>
            <Text style={styles.closeValue}>{formatTsh(totalRevenue - moneyOut.expenses)}</Text>
            <Text style={styles.closeHint}>
              Sales − Expenses — what your admin will close with.
            </Text>
          </View>

          <View style={[styles.card, { marginTop: spacing.md }]}>
            <Text style={styles.sectionTitle}>Day's money out (from till)</Text>
            <Text style={styles.moneyHint}>
              Expenses are taken from today's Sales. New stock is already inside
              Sales — it is not subtracted here.
            </Text>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLabel}>Expenses (today)</Text>
              <Text style={styles.moneyValue}>− {formatTsh(moneyOut.expenses)}</Text>
            </View>
            <View style={[styles.moneyRow, styles.moneyRowTotal]}>
              <Text style={styles.moneyLabelTotal}>TOTAL MONEY OUT</Text>
              <Text style={[styles.moneyValue, { color: colors.gold }]}>− {formatTsh(moneyOut.expenses)}</Text>
            </View>
          </View>

          <View style={[styles.card, { marginTop: spacing.sm, backgroundColor: colors.surfaceAlt }]}>
            <Text style={styles.sectionTitle}>Stock purchases — added by admin (not from till)</Text>
            <View style={styles.moneyRow}>
              <Text style={styles.moneyLabel}>Stock Receiving</Text>
              <Text style={styles.moneyValue}>{formatTsh(moneyOut.receiving)}</Text>
            </View>
            <View style={[styles.moneyRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.moneyLabel}>Stock Requests</Text>
              <Text style={styles.moneyValue}>{formatTsh(moneyOut.request)}</Text>
            </View>
            <Text style={styles.moneyHint}>Received stock items included in sales.</Text>
          </View>

          <Pressable style={styles.confirmCheck} onPress={() => setExpensesConfirmed((v) => !v)}>
            <View
              style={[
                styles.checkBox,
                expensesConfirmed && { backgroundColor: colors.success, borderColor: colors.success },
              ]}
            >
              {expensesConfirmed && <Ionicons name="checkmark" size={14} color={colors.white} />}
            </View>
            <Text style={styles.confirmCheckText}>
              I confirm today's expenses of {formatTsh(moneyOut.expenses)} are
              all recorded in the app.
            </Text>
          </Pressable>

          {!expensesConfirmed && (
            <Pressable style={styles.expenseLink} onPress={() => navigation.navigate('Expenses')}>
              <Ionicons name="receipt-outline" size={15} color={colors.sky} />
              <Text style={styles.expenseLinkText}>Add today's expenses →</Text>
            </Pressable>
          )}
        </ScrollView>
        <View style={[styles.submitBar, { bottom: insets.bottom }]}>
          <Pressable
            style={[styles.submitBtn, (submitting || !expensesConfirmed) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting || !expensesConfirmed}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting…' : !expensesConfirmed ? 'Confirm money records to submit' : 'Submit Sales Report'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (blockedOnOpening) {
    return (
      <View style={styles.flex}>
        <AppWatermark />
        <ModuleHeader
          title="Daily Closing"
          subtitle="Count the items still in the shop"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.centerWrap}>
          <Image
            source={require('../../assets/logo-transparent.png')}
            style={styles.smartLogo}
            resizeMode="contain"
          />
          <Text style={styles.successTitle}>Today's Closing Sales Page Not Active</Text>
          <Text style={styles.mutedText}>
            Go And Confirm in Shop Opening And Come Back. Once the new opening stock
            is confirmed, the closing page opens for the next day automatically.
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (submitted) {
    const approved = closing?.status === 'approved';
    return (
      <View style={styles.flex}>
        <AppWatermark />
        <ModuleHeader
          title="Daily Closing"
          subtitle="Count the items still in the shop"
          onBack={() => {}}
        />
        {approved ? renderApproved() : renderSubmitted()}
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <AppWatermark />
      <ModuleHeader
        title="Daily Closing"
        subtitle="Count the items still in the shop"
        onBack={() => navigation.goBack()}
      />
      {renderDateStepper()}
      {isFuture ? (
        <View style={styles.centerWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={30} color={colors.sky} />
          </View>
          <Text style={styles.emptyTitle}>Not open yet</Text>
          <Text style={styles.mutedText}>
            Closing for {formatDateLabel(date)} opens when that day arrives. You can
            only enter closing for today, or an earlier day that is not yet closed.
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => { setUnlockNext(false); setDate(today); }}>
            <Text style={styles.doneBtnText}>Back to Today</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.sky} />
          <Text style={styles.mutedText}>Loading the day's stock…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cube-outline" size={30} color={colors.sky} />
          </View>
          <Text style={styles.emptyTitle}>No stock reference yet</Text>
          <Text style={styles.mutedText}>
            Confirm this morning's opening stock, or ask your admin to add products
            before closing.
          </Text>
          <Pressable style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {search !== '' && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <FlatList
            ref={listRef}
            style={styles.body}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 180 }}
            data={filteredRows}
            keyExtractor={(r) => r.key}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
            }}
            ListHeaderComponent={
              <View>
                {missingRows.length > 0 ? (
                  <View style={[styles.missStrip, { backgroundColor: `${colors.danger}1A` }]}>
                    <Ionicons name="alert-circle" size={17} color={colors.danger} />
                    <Text style={[styles.missStripText, { color: colors.danger }]}>
                      {missingRows.length} of {rows.length} items still need their remaining
                      count — review is locked until all are filled.
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.missStrip, { backgroundColor: `${colors.success}1A` }]}>
                    <Ionicons name="checkmark-circle" size={17} color={colors.success} />
                    <Text style={[styles.missStripText, { color: colors.success }]}>
                      All {rows.length} items counted — you can review your data.
                    </Text>
                  </View>
                )}
                <View style={styles.noticeCard}>
                  <Ionicons name="calculator-outline" size={18} color={colors.sky} />
                  <Text style={styles.noticeText}>
                    Enter the exact quantity REMAINING in the shop for each item. It
                    cannot go above the current stock. Sold = Current − Remaining, and
                    revenue is calculated automatically.
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.noMatchWrap}>
                <Text style={styles.mutedText}>No items match "{search}".</Text>
              </View>
            }
            renderItem={({ item }) => {
              const row = computedRows.find((c) => c.key === item.key)!;
              const over = row.remainingNum !== null && row.remainingNum > row.current;
              const missing = row.remaining === '';
              return (
                <View style={[styles.card, missing && styles.missCard]}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.topRight}>
                      <Text style={styles.itemPrice}>{formatTsh(item.price)}</Text>
                      {missing ? (
                        <View style={[styles.missBadge, { backgroundColor: `${colors.danger}1F` }]}>
                          <Ionicons name="warning" size={11} color={colors.danger} />
                          <Text style={[styles.badgeText, { color: colors.danger }]}>Not set</Text>
                        </View>
                      ) : (
                        <View style={[styles.okBadge, { backgroundColor: `${colors.success}1F` }]}>
                          <Ionicons name="checkmark" size={11} color={colors.success} />
                          <Text style={[styles.badgeText, { color: colors.success }]}>Counted</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <View style={[styles.currentChip, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name="layers-outline" size={13} color={colors.text} />
                      <Text style={styles.currentChipText}>Current: {item.current}</Text>
                    </View>
                    <Text style={[styles.soldText, { color: row.remainingNum === null ? colors.textMuted : colors.sky }]}>
                      Sold: {row.sold}
                    </Text>
                    <Text style={[styles.revText2, { color: colors.gold }]}>
                      Rev: {formatTsh(row.revenue)}
                    </Text>
                  </View>
                  <View style={styles.countRow}>
                    <View style={[styles.countBox, missing && styles.missCountBox]}>
                      <Text style={styles.countLabel}>Remaining Quantity (required)</Text>
                      <TextInput
                        style={[styles.input, over && { color: colors.danger }]}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        value={item.remaining}
                        onChangeText={(v) => updateRemaining(item.key, v.replace(/[^0-9]/g, ''))}
                      />
                    </View>
                  </View>
                  {over && (
                    <View style={[styles.overBanner, { backgroundColor: `${colors.danger}1A` }]}>
                      <Ionicons name="warning" size={14} color={colors.danger} />
                      <Text style={[styles.overText, { color: colors.danger }]}>
                        Remaining cannot exceed current stock ({item.current}).
                      </Text>
                    </View>
                  )}
                </View>
              );
            }}
          />

          <View style={[styles.submitBar, { bottom: insets.bottom }]}>
            {missingRows.length > 0 && (
              <Text style={styles.submitMissHint}>
                {missingRows.length} item{missingRows.length > 1 ? 's' : ''} still missing a count
              </Text>
            )}
            <Pressable onPress={handleReview}>
              <Text style={styles.reviewLink}>Review your data</Text>
            </Pressable>
            <Pressable style={styles.submitBtn} onPress={handleReview}>
              <Text style={styles.submitBtnText}>Review your data →</Text>
            </Pressable>
          </View>

          <Modal
            visible={missingModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setMissingModalOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <View style={[styles.modalIcon, { backgroundColor: `${colors.danger}1F` }]}>
                    <Ionicons name="alert-circle" size={26} color={colors.danger} />
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>Missing counts · {missingRows.length}</Text>
                    <Text style={styles.modalSub}>
                      Review is locked until every item has a remaining quantity. Use
                      "Fill 1st missing" to jump straight to the first one.
                    </Text>
                  </View>
                </View>
                <ScrollView style={styles.modalList} nestedScrollEnabled>
                  {missingRows.map((r) => (
                    <View key={r.key} style={styles.modalRow}>
                      <View style={[styles.modalDot, { backgroundColor: colors.danger }]} />
                      <Text style={styles.modalRowText} numberOfLines={1}>{r.name}</Text>
                      <Text style={[styles.modalRowBadge, { color: colors.danger }]}>Not set</Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.modalBtnGhost, { borderColor: colors.border }]}
                    onPress={() => setMissingModalOpen(false)}
                  >
                    <Text style={styles.modalBtnGhostText}>Close</Text>
                  </Pressable>
                  <Pressable style={styles.modalBtnPrimary} onPress={goToFirstMissing}>
                    <Text style={styles.modalBtnPrimaryText}>Fill 1st missing →</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
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
    missCard: {
      borderWidth: 1,
      borderColor: `${c.danger}55`,
    },
    topRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    missBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    okBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10,
    },
    missCountBox: {
      borderWidth: 1,
      borderColor: `${c.danger}7A`,
    },
    missStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    missStripText: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      lineHeight: 17,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    itemName: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: c.text,
    },
    itemPrice: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: c.gold,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      flexWrap: 'wrap',
    },
    currentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    currentChipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11.5,
      color: c.text,
    },
    soldText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
    },
    revText2: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
    },
    countRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    countBox: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    countLabel: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
      marginBottom: 4,
    },
    input: {
      fontFamily: fonts.headingBold,
      fontSize: 20,
      color: c.text,
      padding: 0,
    },
    overBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radius.sm,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    overText: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
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
      gap: spacing.sm,
    },
    reviewLink: {
      textAlign: 'center',
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: c.sky,
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
    submitMissHint: {
      textAlign: 'center',
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      color: c.danger,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      backgroundColor: c.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 420,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    modalIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalHeaderText: { flex: 1 },
    modalTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 16,
      color: c.text,
      marginBottom: 2,
    },
    modalSub: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.textMuted,
      lineHeight: 17,
    },
    modalList: {
      maxHeight: 240,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.lg,
    },
    modalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    modalDot: { width: 6, height: 6, borderRadius: 3 },
    modalRowText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.text,
    },
    modalRowBadge: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 10.5,
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    modalBtnGhost: {
      flex: 1,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingVertical: 13,
      alignItems: 'center',
    },
    modalBtnGhostText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13.5,
      color: c.text,
    },
    modalBtnPrimary: {
      flex: 1.4,
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.pill,
      paddingVertical: 13,
      alignItems: 'center',
    },
    modalBtnPrimaryText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13.5,
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
      textAlign: 'center',
    },
    sectionTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 14,
      color: c.text,
      marginBottom: 2,
    },
    closeTitle: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      color: c.textMuted,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    closeValue: {
      fontFamily: fonts.headingBold,
      fontSize: 24,
      color: c.navy,
      textAlign: 'center',
      marginVertical: 2,
    },
    closeHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
    },
    moneyHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.textMuted,
      lineHeight: 17,
      marginBottom: spacing.sm,
    },
    moneyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    moneyRowTotal: {
      borderBottomWidth: 0,
      marginTop: spacing.xs,
    },
    moneyLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.text,
    },
    moneyLabelTotal: {
      fontFamily: fonts.headingBold,
      fontSize: 13,
      color: c.navy,
    },
    moneyValue: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.text,
    },
    confirmCheck: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    checkBox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmCheckText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: c.text,
      lineHeight: 18,
    },
    expenseLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    expenseLinkText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: c.sky,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 16,
      color: c.text,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    mutedText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 19,
    },
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    smartLogo: {
      width: 130,
      height: 130,
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
      lineHeight: 19,
      marginBottom: spacing.xl,
    },
    pdfBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.gold,
      borderRadius: radius.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm,
    },
    pdfBtnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13.5,
      color: '#1a1305',
    },
    pdfHint: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      color: c.textMuted,
      textAlign: 'center',
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
    doneHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
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
    todayBtn: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.pill,
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
    },
    todayBtnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: c.sky,
    },
    dateStepperBtnSpacer: {
      width: 62,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      height: 46,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.text,
      padding: 0,
    },
    noMatchWrap: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
  });