import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';

type Tone = 'ok' | 'warning' | 'danger';

const TONE_MAP: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  ok: 'checkmark-circle',
  warning: 'alert-circle',
  danger: 'warning',
};

export default function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const { colors } = useTheme();
  const fg =
    tone === 'ok' ? colors.success : tone === 'warning' ? colors.amber : colors.danger;
  return (
    <View style={[styles.pill, { backgroundColor: `${fg}1A` }]}>
      <Ionicons name={TONE_MAP[tone]} size={14} color={fg} />
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 6,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
  },
});