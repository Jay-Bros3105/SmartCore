import React from 'react';
import {
  NavigationContainer,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import ApprovalGateScreen from '../screens/ApprovalGateScreen';
import TabNavigator, { MainTabParamList } from './TabNavigator';
import HomeScreen from '../screens/HomeScreen';
import DailyOpeningScreen from '../screens/DailyOpeningScreen';
import StockReceivingScreen from '../screens/StockReceivingScreen';
import DailyClosingScreen from '../screens/DailyClosingScreen';
import CashReconciliationScreen from '../screens/CashReconciliationScreen';
import StockRequestScreen from '../screens/StockRequestScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import CurrentStockScreen from '../screens/CurrentStockScreen';
import DailyReportScreen from '../screens/reports/DailyReportScreen';
import ShopReportScreen from '../screens/reports/ShopReportScreen';
import ProductReportScreen from '../screens/reports/ProductReportScreen';
import PeriodReportScreen from '../screens/reports/PeriodReportScreen';
import ActivityTimelineScreen from '../screens/reports/ActivityTimelineScreen';
import type { ManagerProfile } from '../services/types';

export type RootStackParamList = {
  Onboarding: undefined;
  ApprovalGate: { profile: ManagerProfile };
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  DailyOpening: undefined;
  StockReceiving: undefined;
  DailyClosing: undefined;
  CashReconciliation: undefined;
  StockRequest: undefined;
  Expenses: undefined;
  CurrentStock: undefined;
  DailyReport: undefined;
  ShopReport: undefined;
  ProductReport: undefined;
  PeriodReport: undefined;
  ActivityTimeline: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type Props = {
  manager: ManagerProfile | null;
};

export default function RootNavigator({ manager }: Props) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={manager ? 'ApprovalGate' : 'Onboarding'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Onboarding" options={{ animation: 'fade' }}>
          {({ navigation }) => (
            <OnboardingScreen
              onComplete={(profile) =>
                navigation.replace('ApprovalGate', { profile })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ApprovalGate" options={{ animation: 'fade' }}>
          {({ navigation, route }) => {
            const profile = route.params?.profile ?? manager;
            if (!profile) {
              navigation.replace('Onboarding');
              return null;
            }
            return (
              <ApprovalGateScreen
                profile={profile}
                onApproved={() => navigation.replace('MainTabs')}
                onReset={() => navigation.replace('Onboarding')}
              />
            );
          }}
        </Stack.Screen>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen
          name="DailyOpening"
          component={DailyOpeningScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="StockReceiving"
          component={StockReceivingScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DailyClosing"
          component={DailyClosingScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CashReconciliation"
          component={CashReconciliationScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="StockRequest"
          component={StockRequestScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Expenses"
          component={ExpensesScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CurrentStock"
          component={CurrentStockScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DailyReport"
          component={DailyReportScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ShopReport"
          component={ShopReportScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ProductReport"
          component={ProductReportScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PeriodReport"
          component={PeriodReportScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ActivityTimeline"
          component={ActivityTimelineScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}