const categories = {
  kiryana: '#10B981',
  bijliBill: '#F59E0B',
  gasBill: '#EF4444',
  paniBill: '#38BDF8',
  schoolFees: '#8B5CF6',
  transport: '#EC4899',
  medical: '#DC2626',
  chaiNashta: '#D97706',
  kapray: '#7C3AED',
  rent: '#059669',
  general: '#14B8A6',
};

export const lightColors = {
  primary: '#1E3A5F',
  primaryLight: '#2D5A8E',
  primaryDark: '#142842',
  accent: '#34D399',
  accentLight: '#6EE7B7',
  background: '#F8F9FB',
  card: '#FFFFFF',
  surface: '#EFF2F7',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  border: '#E2E6ED',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  success: '#10B981',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  categories,
  tabIconDefault: '#9CA3AF',
  tabIconSelected: '#1E3A5F',
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#1E3A5F',
  accent: '#34D399',
  accentLight: '#6EE7B7',
  background: '#0F1729',
  card: '#1A2332',
  surface: '#243044',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: '#2D3B4F',
  danger: '#EF4444',
  dangerLight: '#3B1414',
  success: '#10B981',
  warning: '#F59E0B',
  warningLight: '#3B2F0F',
  categories,
  tabIconDefault: '#64748B',
  tabIconSelected: '#3B82F6',
};

// Default export for backwards compatibility (light theme)
const Colors = lightColors;
export default Colors;
