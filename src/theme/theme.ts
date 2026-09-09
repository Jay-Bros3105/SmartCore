/**
 * Neo SmartCore — Design Tokens
 * Rangi hizi zimetolewa moja kwa moja kwenye Sehemu ya 12 ya Full Proposal
 * (Mapendekezo ya Rangi na Muonekano wa App - UI/UX Design).
 */

export const colors = {
  navy: '#1F4E79',        // Vichwa vya habari, header, logo, vitufe muhimu
  sky: '#2BB6C9',         // SECONDARY — buluu ya splash/logo (cyan/teal)
  light: '#DCE9F5',       // Mandhari ya kadi (cards)
  pale: '#EAF3FB',        // Background ya skrini nzima
  logoBlue: '#2BB6C9',     // Buluu ya logo (cyan/teal)
  logoBlueDeep: '#146B78', // Buluu nzito ya logo (rangi ya checkmark/msingi wa gradient)
  white: '#FFFFFF',
  success: '#2E7D32',     // "No Variance"
  amber: '#F2A93B',       // "Low Stock"
  danger: '#C62828',      // "Variance Detected" / "Cash Difference"
  gold: '#C9A227',        // Lafudhi maalum kwenye ripoti
  charcoal: '#595959',    // Maandishi ya kawaida / subtext
  black: '#10202E',
  // DARK MODE — deep dark blue background + light blue (logo) accent
  dark: {
    background: '#0B1F30',      // Deep dark blue (background nzima)
    surface: '#122A3D',         // Kadi / sehemu za taarifa
    surfaceAlt: '#183449',      // Slightly lighter surfaces
    border: '#1E4E61',
    text: '#E4F1F8',            // Maandishi ya kawaida
    textMuted: '#8FB3C4',       // Maandishi yaliyo tulivu (subtext)
    accent: '#2BB6C9',          // Light blue ya logo
    accentDeep: '#146B78',
    white: '#FFFFFF',
  },
};

export const gradients = {
  splash: [colors.pale, colors.light] as const,
  header: [colors.navy, colors.sky] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

export const fonts = {
  heading: 'Poppins_600SemiBold',
  headingBold: 'Poppins_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  serifBrand: 'Tinos_700Bold',      // Times New Roman (Tinos = clone sameyeki)
  serifBrandRegular: 'Tinos_400Regular',
  scriptAccent: 'Allura_400Regular', // Monotype Corsiva style (Allura)
};

export const shadow = {
  card: {
    shadowColor: '#1F4E79',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  soft: {
    shadowColor: '#1F4E79',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
};

export default { colors, gradients, spacing, radius, fonts, shadow };
