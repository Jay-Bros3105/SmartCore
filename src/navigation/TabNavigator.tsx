import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import MoreScreen from '../screens/MoreScreen';

export type MainTabParamList = {
  Home: undefined;
  Transactions: undefined;
  Reports: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICON: Record<
  keyof MainTabParamList,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Transactions: { active: 'swap-horizontal', inactive: 'swap-horizontal-outline' },
  Reports: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  More: { active: 'menu', inactive: 'menu-outline' },
};

export default function TabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pillBottom = Platform.OS === 'android' ? insets.bottom + 14 : insets.bottom + 14;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.logoBlueDeep,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          position: 'absolute',
          left: 26,
          right: 26,
          bottom: pillBottom,
          height: 62,
          borderRadius: 31,
          backgroundColor: colors.bg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: 6,
          paddingBottom: 6,
          paddingLeft: 6,
          paddingRight: 6,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.16,
          shadowRadius: 16,
          elevation: 8,
        },
        tabBarItemStyle: {
          borderRadius: 24,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICON[route.name as keyof MainTabParamList];
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'Transactions' }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reports' }}
      />
      <Tab.Screen name="More" component={MoreScreen} options={{ title: 'More' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 1,
  },
});