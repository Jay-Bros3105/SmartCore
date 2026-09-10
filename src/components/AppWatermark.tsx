import React, { useMemo } from 'react';
import { Image, StyleSheet, View, type DimensionValue } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Cell = { top: DimensionValue; left: DimensionValue; size: number; rotate: string };

const CELLS: Cell[] = [
  { top: '4%', left: '6%', size: 40, rotate: '-10deg' },
  { top: '4%', left: '34%', size: 34, rotate: '8deg' },
  { top: '4%', left: '63%', size: 42, rotate: '-5deg' },
  { top: '20%', left: '78%', size: 38, rotate: '12deg' },
  { top: '34%', left: '8%', size: 44, rotate: '6deg' },
  { top: '34%', left: '50%', size: 36, rotate: '-12deg' },
  { top: '50%', left: '28%', size: 48, rotate: '9deg' },
  { top: '60%', left: '72%', size: 40, rotate: '-8deg' },
  { top: '68%', left: '6%', size: 36, rotate: '11deg' },
  { top: '78%', left: '44%', size: 44, rotate: '-6deg' },
  { top: '88%', left: '12%', size: 34, rotate: '7deg' },
  { top: '88%', left: '70%', size: 38, rotate: '-9deg' },
];

/** Background ya app — nembo za "Neo SmartCore" zikijirudia kama watermark
 *  (nyingi, zikisambazwa, zisibanane, rangi ya logo tu kwa njia nyepesi). */
export default function AppWatermark() {
  const { colors } = useTheme();

  const cells = useMemo(
    () =>
      CELLS.map((c, i) => {
        const opacityRatio = 0.05 + ((i * 7) % 3) * 0.02;
        return (
          <Image
            key={i}
            source={require('../../assets/logo-transparent.png')}
            resizeMode="contain"
            style={[
              styles.logo,
              {
                width: c.size,
                height: c.size,
                top: c.top,
                left: c.left,
                tintColor: colors.logoBlue,
                opacity: opacityRatio,
                transform: [{ rotate: c.rotate }],
              },
            ]}
          />
        );
      }),
    [colors.logoBlue]
  );

  return <View pointerEvents="none" style={styles.fill}>{cells}</View>;
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  logo: {
    position: 'absolute',
  },
});