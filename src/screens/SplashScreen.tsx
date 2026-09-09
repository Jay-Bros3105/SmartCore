import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, spacing } from '../theme/theme';

type Props = {
  onFinish: () => void;
};

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.42, 190);

// Logo huanzia "ndani" (kibonge) kisha inaexpand nje kuijaza mduara.
const MIN_SCALE = 0.42;
// Muda wa logo kusonga kutoka ndani hadi ukubwa kamili (expand).
const EXPAND_DURATION = 1800;
// Muda wa ku-hold kabla ya kuondoka kwenye splash.
const HOLD_AFTER_REVEAL = 1500;

export default function SplashScreen({ onFinish }: Props) {
  const logoScale = useRef(new Animated.Value(MIN_SCALE)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(16)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Hatua ya 1: mduara mweupe unafifia ndani kwa haraka, logo inaanza
    // ndani (MIN_SCALE) na inaexpand nje kwa kupita kidogo (overshoot).
    const expand = Animated.parallel([
      Animated.timing(ringOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        delay: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: EXPAND_DURATION,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]);

    // Hatua ya 2: jina na tagline vinatokea baada ya logo kukamilisha expand.
    const reveal = Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(textTranslateY, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 750,
        delay: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -10,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 520,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.sequence([expand, reveal]).start(() => {
      bounceLoop.start();
      const timer = setTimeout(() => {
        bounceLoop.stop();
        onFinish();
      }, HOLD_AFTER_REVEAL);
      return () => clearTimeout(timer);
    });

    return () => {
      bounceLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LinearGradient
      colors={[colors.logoBlue, colors.logoBlueDeep]}
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex}>
        <View style={styles.center}>
          <View style={styles.logoWrap}>
            <Animated.View
              style={[
                styles.glowRing,
                {
                  opacity: ringOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            />
            <Animated.Image
              source={require('../../assets/splash-logo.png')}
              style={[
                styles.logo,
                {
                  opacity: logoOpacity,
                  transform: [
                    { scale: logoScale },
                    { translateY: bounce },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          </View>

          <Animated.Text
            style={[
              styles.brand,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            Neo SmartCore
          </Animated.Text>

          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            The Intelligent Core of Your Business
          </Animated.Text>
        </View>

        <Animated.Text style={[styles.footer, { opacity: taglineOpacity }]}>
          JSL FastLine Technologies
        </Animated.Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    height: LOGO_SIZE + 40,
    width: LOGO_SIZE + 40,
  },
  glowRing: {
    position: 'absolute',
    width: LOGO_SIZE + 40,
    height: LOGO_SIZE + 40,
    borderRadius: (LOGO_SIZE + 40) / 2,
    backgroundColor: colors.white,
    shadowColor: '#148B9C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 8,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  brand: {
    fontFamily: fonts.serifBrand,
    fontSize: 34,
    color: colors.white,
    letterSpacing: 0.4,
  },
  tagline: {
    fontFamily: fonts.scriptAccent,
    fontSize: 26,
    color: colors.white,
    marginTop: -4,
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 12,
    color: '#EAF9FB',
    marginBottom: spacing.lg,
    letterSpacing: 0.4,
  },
});