import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import ActionCard from '../components/ActionCard';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';
import type { MainTabParamList } from '../navigation/TabNavigator';

type Props = BottomTabScreenProps<MainTabParamList, 'Transactions'>;

type ModuleRoute =
  | 'DailyOpening'
  | 'StockReceiving'
  | 'DailyClosing'
  | 'CashReconciliation'
  | 'StockRequest'
  | 'Expenses';

const MODULES: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof ActionCard>['icon'];
  accent: string;
  route: ModuleRoute;
}[] = [
  {
    title: 'Shop Opening',
    subtitle: 'Confirm morning stock',
    icon: 'download-outline',
    accent: '#0285C7',
    route: 'DailyOpening',
  },
  {
    title: 'Stock Receiving',
    subtitle: 'Record received delivery',
    icon: 'cube-outline',
    accent: '#0285C7',
    route: 'StockReceiving',
  },
  {
    title: 'Daily Closing',
    subtitle: 'Count and submit stock',
    icon: 'cloud-upload-outline',
    accent: '#D18F00',
    route: 'DailyClosing',
  },
  {
    title: 'Cash Reconciliation',
    subtitle: 'Cash vs expectations',
    icon: 'cash-outline',
    accent: '#097349',
    route: 'CashReconciliation',
  },
  {
    title: 'Request Stock',
    subtitle: 'Send a request to Admin',
    icon: 'send-outline',
    accent: '#0285C7',
    route: 'StockRequest',
  },
  {
    title: 'Expenses',
    subtitle: 'Add costs and receipts',
    icon: 'receipt-outline',
    accent: '#D18F00',
    route: 'Expenses',
  },
];

export default function TransactionsScreen({ navigation }: Props) {
  const { colors } = useTheme();

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
            <Text style={[styles.title, { color: colors.text }]}>Transactions</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            All your daily tasks
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {MODULES.map((m) => (
              <ActionCard
                key={m.route}
                title={m.title}
                subtitle={m.subtitle}
                icon={m.icon}
                accent={m.accent}
                onPress={() => navigation.getParent()?.navigate(m.route as never)}
              />
            ))}
          </View>

          <View
            style={[
              styles.note,
              { backgroundColor: colors.bg, shadowColor: colors.shadow },
            ]}
          >
            <Text style={[styles.noteText, { color: colors.textMuted }]}>
              Note: A manager never enters sold quantities or revenue — you only
              record the actual stock state, and the system calculates the rest.
              (Proposal · Section 4)
            </Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  note: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  noteText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
});