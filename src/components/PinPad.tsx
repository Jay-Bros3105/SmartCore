import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, spacing } from '../theme/theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  error?: boolean;
};

const ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['empty', '0', 'back'],
];

export default function PinPad({ value, onChange, maxLength, error }: Props) {
  const { colors } = useTheme();

  const press = (k: string) => {
    if (k === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === 'empty' || k === '' || value.length >= maxLength) return;
    onChange(value + k);
  };

  const dots = Array.from({ length: maxLength });

  return (
    <View>
      <View style={styles.dotsRow}>
        {dots.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < value.length ? colors.logoBlue : colors.bg,
                borderColor: i < value.length ? colors.logoBlue : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.grid}>
        {ROWS.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((k, i) =>
              k === 'empty' ? (
                <View key={i} style={styles.cell} />
              ) : (
                <Pressable
                  key={i}
                  onPress={() => press(k)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.cell,
                    styles.key,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  {k === 'back' ? (
                    <Ionicons name="backspace-outline" size={24} color={colors.text} />
                  ) : (
                    <Text style={[styles.keyText, { color: error ? colors.danger : colors.text }]}>{k}</Text>
                  )}
                </Pressable>
              )
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  grid: {
    alignSelf: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: spacing.sm,
  },
  cell: {
    width: 66,
    height: 66,
    borderRadius: radius.pill,
  },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  keyText: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
  },
});