import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ModuleHeader from './ModuleHeader';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';

type Props = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  points: string[];
  onBack: () => void;
};

export default function ComingSoonModule({ title, subtitle, icon, points, onBack }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ModuleHeader title={title} subtitle={subtitle} onBack={onBack} />
      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name={icon} size={30} color={colors.sky} />
        </View>
        <Text style={[styles.heading, { color: colors.text }]}>
          This module is being completed
        </Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>
          The full form for "{title}" will be connected to the backend in the next
          stage of the MVP. For now, this is how it will work:
        </Text>
        <View style={[styles.list, { backgroundColor: colors.bg }]}>
          {points.map((p, i) => (
            <View key={i} style={styles.listRow}>
              <View style={styles.bullet} />
              <Text style={[styles.listText, { color: colors.text }]}>{p}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, padding: spacing.xl, alignItems: 'center' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  heading: {
    fontFamily: fonts.headingBold,
    fontSize: 17,
    marginBottom: spacing.sm,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  list: {
    width: '100%',
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2BB6C9',
    marginTop: 6,
  },
  listText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
});