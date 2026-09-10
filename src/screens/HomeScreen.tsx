import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import ActionCard from '../components/ActionCard';
import { useTheme } from '../theme/ThemeContext';
import AppWatermark from '../components/AppWatermark';
import { fonts, radius, spacing } from '../theme/theme';
import { getCurrentManager, subscribeProducts } from '../services/storeService';
import type { ShopProduct } from '../services/storeService';
import type { ManagerProfile } from '../services/types';
import type { MainTabParamList } from '../navigation/TabNavigator';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const WEEKDAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDateEn(date: Date) {
  return `${WEEKDAYS_EN[date.getDay()]}, ${date.getDate()} ${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTsh(amount: number) {
  return `TSh ${amount.toLocaleString('en-US')}`;
}

export default function HomeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);

  useEffect(() => {
    let unsubProducts: (() => void) | undefined;
    let cancelled = false;
    getCurrentManager()
      .then((m) => {
        if (cancelled) return;
        setManager(m);
        if (m?.branchId) {
          setProducts([]);
          unsubProducts = subscribeProducts(
            m.branchId,
            (list) => {
              if (!cancelled) setProducts([...list].sort((a, b) => a.name.localeCompare(b.name)));
            },
            () => {}
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unsubProducts?.();
    };
  }, []);

  const firstName = manager?.fullName.split(' ')[0] ?? 'Manager';
  const branchName = manager?.branchName ?? 'Your Shop';

  const goTo = (
    screen: 'DailyOpening' | 'DailyClosing' | 'CashReconciliation' | 'CurrentStock'
  ) => {
    // Tab screens ziko ndani ya Root Stack — navigate kupitia parent
    navigation.getParent()?.navigate(screen as never);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AppWatermark />
      <LinearGradient
        colors={[colors.headerTop, colors.headerBottom]}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            <Image
              source={require('../../assets/logo-transparent.png')}
              style={[styles.homeLogo, { tintColor: colors.onHeader }]}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, { color: colors.onHeader }]}>
                Hello, {firstName}
              </Text>
              <Text style={[styles.branch, { color: colors.onHeader }]}>
                {branchName}
              </Text>
            </View>
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, { color: colors.onHeader }]}>
                {(manager?.fullName ?? 'NS')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </Text>
            </View>
          </View>
          <Text style={[styles.date, { color: colors.onHeader }]}>
            {formatDateEn(new Date())}
          </Text>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: spacing.xxl + 74 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Today's Steps
        </Text>
        <View style={styles.grid}>
          <ActionCard
            title="Shop Opening"
            subtitle="Confirm morning stock"
            icon="download-outline"
            accent={colors.logoBlue}
            onPress={() => goTo('DailyOpening')}
          />
          <ActionCard
            title="Daily Closing"
            subtitle="Count and submit stock"
            icon="cloud-upload-outline"
            accent={colors.gold}
            onPress={() => goTo('DailyClosing')}
          />
          <ActionCard
            title="Cash Reconciliation"
            subtitle="Cash vs expectations"
            icon="cash-outline"
            accent={colors.success}
            onPress={() => goTo('CashReconciliation')}
          />
          <ActionCard
            title="Current Stock"
            subtitle="Items added by your Admin"
            icon="cube-outline"
            accent={colors.logoBlue}
            onPress={() => goTo('CurrentStock')}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Your Shop's Products
        </Text>
        <View
          style={[
            styles.activityCard,
            { backgroundColor: colors.bg, shadowColor: colors.shadow },
          ]}
        >
          {products.length === 0 ? (
            <View style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: `${colors.logoBlue}1A` }]}>
                <Ionicons name="pricetag-outline" size={18} color={colors.logoBlue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.text }]}>
                  No products yet
                </Text>
                <Text style={[styles.activitySubtitle, { color: colors.textMuted }]}>
                  Once your admin adds products to this shop, they'll appear here
                  in real time.
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.stockTableHeader, { backgroundColor: colors.border }]}>
                <Text style={[styles.stockCol, styles.stockColSn, { color: colors.onHeader }]}>
                  S/N
                </Text>
                <Text style={[styles.stockCol, styles.stockColItem, { color: colors.onHeader }]}>
                  Item
                </Text>
                <Text style={[styles.stockCol, styles.stockColNum, { color: colors.onHeader }]}>
                  Price
                </Text>
              </View>
              {products.map((p, index) => (
                <View
                  key={p.id}
                  style={[
                    styles.stockTableRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: index % 2 === 1 ? colors.bg : undefined,
                    },
                  ]}
                >
                  <Text style={[styles.stockCol, styles.stockColSn, styles.stockRowText, { color: colors.text }]}>
                    {index + 1}
                  </Text>
                  <Text
                    style={[styles.stockCol, styles.stockColItem, styles.stockRowText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  <Text style={[styles.stockCol, styles.stockColNum, styles.stockRowText, { color: colors.text }]}>
                    {formatTsh(p.price)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.footerBrand}>
          <Image
            source={require('../../assets/logo-transparent.png')}
            style={[styles.footerLogo, { tintColor: colors.logoBlue }]}
            resizeMode="contain"
          />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Neo SmartCore · JSL FastLine Technologies
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  greeting: {
    fontFamily: fonts.body,
    fontSize: 13,
    opacity: 0.85,
  },
  branch: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  homeLogo: {
    width: 34,
    height: 34,
    marginRight: spacing.sm,
  },
  date: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    opacity: 0.85,
    marginTop: spacing.sm,
  },
  body: { flex: 1, marginTop: -spacing.lg },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  activityCard: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
  },
  activitySubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  stockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stockTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
  },
  stockTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  stockCol: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
  },
  stockColItem: { flex: 1.8, paddingRight: spacing.sm },
  stockColNum: { flex: 1, textAlign: 'right' },
  stockColSn: { width: 30 },
  stockTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
  },
  stockRowText: {
    fontFamily: fonts.body,
    fontSize: 12,
  },
  stockTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.sm,
  },
  stockTotalText: {
    fontFamily: fonts.headingBold,
    fontSize: 13,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  pdfBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13.5,
    color: '#1a1305',
  },
  pdfHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footerBrand: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  footerLogo: {
    width: 28,
    height: 28,
    opacity: 0.6,
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
});