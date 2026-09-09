import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import type { MainTabParamList } from '../navigation/TabNavigator';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = BottomTabScreenProps<MainTabParamList, 'Reports'>;

type ReportCard = {
  key: keyof RootStackParamList;
  title: string;
  subtitle: string;
  hint: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
};

export default function ReportsScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const cards: ReportCard[] = [
    {
      key: 'DailyReport',
      title: 'Daily Business Report',
      subtitle: 'Sales, expenses, cash variance and net cash for one day',
      hint: 'Today in review',
      icon: 'today-outline',
      tint: '#2BB6C9',
    },
    {
      key: 'ShopReport',
      title: 'Shop Report',
      subtitle: 'Current stock health, low stock and sales summary',
      hint: 'Stock overview',
      icon: 'storefront-outline',
      tint: '#1F4E79',
    },
    {
      key: 'ProductReport',
      title: 'Product Report',
      subtitle: 'Units sold, remaining and revenue per product',
      hint: 'Per product',
      icon: 'cube-outline',
      tint: '#2E7D32',
    },
    {
      key: 'PeriodReport',
      title: 'Weekly & Monthly Report',
      subtitle: 'Revenue trends, best products and day-by-day history',
      hint: 'Last 7 / 30 days',
      icon: 'calendar-outline',
      tint: '#C9A227',
    },
    {
      key: 'ActivityTimeline',
      title: 'Shop Activity Timeline',
      subtitle: 'Every event in order — openings, closings, cash and stock',
      hint: 'Full sequence',
      icon: 'git-commit-outline',
      tint: '#7A3E9D',
    },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.heading}>
          <View style={styles.headingRow}>
            <Image
              source={require('../../assets/logo-transparent.png')}
              style={[styles.logo, { tintColor: colors.logoBlue }]}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: colors.text }]}>Reports</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Live reports from your shop data
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.banner, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <View style={[styles.bannerIcon, { backgroundColor: colors.border }]}>
              <Ionicons name="analytics-outline" size={18} color={colors.logoBlue} />
            </View>
            <Text style={[styles.bannerText, { color: colors.textMuted }]}>
              Every report is generated from your real closings, stock, expenses
              and cash counts — no manual data.
            </Text>
          </View>

          <View style={styles.grid}>
            {cards.map((c) => (
              <Pressable
                key={c.key}
                style={[styles.card, { backgroundColor: colors.bg, shadowColor: colors.shadow }]}
                onPress={() =>
                  (navigation.navigate as (name: keyof RootStackParamList) => void)(c.key)
                }
              >
                <View style={[styles.cardIcon, { backgroundColor: `${c.tint}1A` }]}>
                  <Ionicons name={c.icon} size={22} color={c.tint} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{c.title}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
                  {c.subtitle}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={[styles.cardHint, { color: c.tint }]}>{c.hint}</Text>
                  <Ionicons name="arrow-forward-circle" size={18} color={c.tint} />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 30,
    height: 30,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  cardHint: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11.5,
  },
});