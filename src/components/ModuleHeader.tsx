import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { fonts, spacing } from '../theme/theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack: () => void;
};

export default function ModuleHeader({ title, subtitle, onBack }: Props) {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={[colors.headerTop, colors.headerBottom]} style={styles.header}>
      <SafeAreaView edges={['top']}>
        <View style={styles.row}>
          <Image
            source={require('../../assets/logo-transparent.png')}
            style={[styles.logo, { tintColor: colors.onHeader }]}
            resizeMode="contain"
          />
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.onHeader} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.onHeader }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.85)' }]}>{subtitle}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 30,
    height: 30,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    marginTop: 2,
  },
});