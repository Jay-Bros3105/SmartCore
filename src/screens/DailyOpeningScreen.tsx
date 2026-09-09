import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import ModuleHeader from '../components/ModuleHeader';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import {
  confirmOpeningStock,
  getCurrentManager,
  subscribeOpeningStock,
} from '../services/storeService';
import type { OpeningStock } from '../services/types';
import { shareStockPdf } from '../utils/stockPdf';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyOpening'>;

function formatTsh(amount: number) {
  return `TSh ${amount.toLocaleString('en-US')}`;
}

export default function DailyOpeningScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [opening, setOpening] = useState<OpeningStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const handleDownloadPdf = async () => {
    if (!opening) return;
    setPdfBusy(true);
    try {
      const res = await shareStockPdf({
        kind: 'OPENING STOCK',
        stock: opening,
        managerName,
        extraLine: opening.status === 'confirmed' ? 'Confirmed' : 'Awaiting confirmation',
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
    let unsub: (() => void) | undefined;
    getCurrentManager()
      .then((m) => {
        if (cancelled) return;
        setManagerName(m?.fullName ?? '');
        if (!m?.branchId) {
          setLoading(false);
          return;
        }
        setBranchId(m.branchId);
        unsub = subscribeOpeningStock(
          m.branchId,
          (o) => {
            if (cancelled) return;
            setOpening((prev) => {
              // Mara baada ya kuthibitisha, usirudie kurudi kwenye opening ya zamani
              // (snapshot inaweza kubadilisha uteuzi baada ya status kuwa 'confirmed').
              if (prev?.status === 'confirmed') {
                return o && o.id === prev.id ? o : prev;
              }
              return o;
            });
            setLoading(false);
          },
          () => {
            if (!cancelled) setLoading(false);
          }
        );
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const handleConfirm = async () => {
    if (!opening?.id) return;
    setConfirming(true);
    const res = await confirmOpeningStock(opening.id, managerName ? { fullName: managerName } : null);
    setConfirming(false);
    if (!res.ok) {
      Alert.alert('Error', res.message ?? 'Failed to confirm. Try again.');
    }
  };

  return (
    <View style={styles.flex}>
      <ModuleHeader
        title="Shop Opening"
        subtitle="Confirm this morning's opening stock"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.sky} />
            <Text style={styles.mutedText}>Loading opening stock…</Text>
          </View>
        ) : !opening || opening.items.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}>
              <Ionicons name="file-tray-outline" size={26} color={colors.sky} />
            </View>
            <Text style={styles.emptyTitle}>Opening stock not ready yet</Text>
            <Text style={styles.mutedText}>
              It appears here automatically once your admin approves yesterday's
              closing stock. Then you'll confirm it right here each morning.
            </Text>
            <Pressable style={styles.doneBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.doneBtnText}>Back to Home</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
            <View style={styles.noticeCard}>
              <Ionicons name="information-circle" size={18} color={colors.sky} />
              <Text style={styles.noticeText}>
                Opening stock for <Text style={{ fontWeight: '700' }}>{opening.date}</Text> — generated from
                yesterday's approved closing. You can't edit it by hand — confirm it
                matches reality before sales begin.
              </Text>
            </View>

            <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
              <View style={styles.tableHead}>
                <Text style={[styles.col, styles.colItem, styles.headText]}>Item</Text>
                <Text style={[styles.col, styles.colNum, styles.headText]}>In Stock</Text>
                <Text style={[styles.col, styles.colNum, styles.headText]}>Price</Text>
                <Text style={[styles.col, styles.colNum, styles.headText]}>Total</Text>
              </View>
              {opening.items.map((it, i) => (
                <View key={`${it.name}-${i}`} style={[styles.row, i % 2 === 1 && { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.col, styles.colItem, styles.rowText]} numberOfLines={1}>
                    {it.name}
                  </Text>
                  <Text style={[styles.col, styles.colNum, styles.rowText]}>{it.qty}</Text>
                  <Text style={[styles.col, styles.colNum, styles.rowText]}>{formatTsh(it.price)}</Text>
                  <Text style={[styles.col, styles.colNum, styles.rowText]}>{formatTsh(it.total)}</Text>
                </View>
              ))}
              <View style={[styles.row, { backgroundColor: `${colors.gold}1A` }]}>
                <Text style={[styles.col, styles.colItem, styles.totalText]}>TOTAL</Text>
                <Text style={[styles.col, styles.colNum, styles.totalText]}>{formatTsh(opening.total)}</Text>
              </View>
            </View>

            <Pressable
              style={[styles.pdfBtn, pdfBusy && { opacity: 0.6 }]}
              disabled={pdfBusy}
              onPress={handleDownloadPdf}
            >
              <Ionicons name="download-outline" size={18} color="#1a1305" />
              <Text style={styles.pdfBtnText}>
                {pdfBusy ? 'Creating PDF…' : `Download PDF · ${opening.date}`}
              </Text>
            </Pressable>
            <Text style={styles.pdfHint}>
              Share this day's opening stock to your Admin via WhatsApp.
            </Text>

            {opening.status === 'confirmed' ? (
              <View style={styles.confirmDone}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.confirmDoneText}>
                  Opening stock confirmed — it is now the reference for today's closing.
                </Text>
              </View>
            ) : (
              <Pressable
                style={[styles.confirmBtn, confirming && { opacity: 0.6 }]}
                onPress={handleConfirm}
                disabled={confirming}
              >
                <Ionicons name="checkmark" size={18} color={colors.white} />
                <Text style={styles.confirmBtnText}>
                  {confirming ? 'Confirming…' : 'Confirm Opening Stock — Send to Admin'}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    body: { flex: 1, padding: spacing.lg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    noticeCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
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
      marginBottom: spacing.md,
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
      fontSize: 11,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    col: { fontFamily: fonts.body, fontSize: 12 },
    colItem: { flex: 1.8, paddingRight: spacing.sm },
    colNum: { flex: 1, textAlign: 'right' },
    rowText: { color: c.text },
    totalText: { fontFamily: fonts.headingBold, fontSize: 13.5, color: c.text },
    pdfBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.gold,
      borderRadius: radius.md,
      paddingVertical: 14,
      marginBottom: spacing.xs,
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
      marginBottom: spacing.md,
    },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.pill,
      paddingVertical: 15,
    },
    confirmBtnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: c.white,
    },
    confirmDone: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: `${c.success}1A`,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    confirmDoneText: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 12.5,
      color: c.success,
    },
    emptyIcon: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    emptyTitle: {
      fontFamily: fonts.headingBold,
      fontSize: 16,
      color: c.text,
      textAlign: 'center',
    },
    mutedText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 19,
    },
    doneBtn: {
      backgroundColor: c.logoBlueDeep,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
      marginTop: spacing.lg,
    },
    doneBtnText: {
      fontFamily: fonts.bodySemiBold,
      color: c.white,
      fontSize: 14,
    },
  });