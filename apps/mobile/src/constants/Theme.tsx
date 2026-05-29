import { Platform } from 'react-native';

export const Colors = {
  primary: '#00418f',
  onPrimary: '#ffffff',
  primaryContainer: '#0058bc',
  onPrimaryContainer: '#c3d4ff',

  secondary: '#4b5e86',
  onSecondary: '#ffffff',
  secondaryContainer: '#bed2ff',
  onSecondaryContainer: '#475981',

  tertiary: '#782c00',
  onTertiary: '#ffffff',
  tertiaryContainer: '#9e3d00',
  onTertiaryContainer: '#ffc9b2',

  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  background: '#f8fafc',
  onBackground: '#0f172a',
  surface: '#ffffff',
  onSurface: '#0f172a',

  surfaceVariant: '#f1f5f9',
  onSurfaceVariant: '#475569',
  outline: '#94a3b8',
  outlineVariant: '#cbd5e1',

  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f8fafc',
  surfaceContainer: '#f1f5f9',
  surfaceContainerHigh: '#e2e8f0',
  surfaceContainerHighest: '#cbd5e1',
  surfaceDim: '#cbd5e1',
};

export const LightColors = { ...Colors };

export const DarkColors = {
  primary: '#3b82f6',
  onPrimary: '#ffffff',
  primaryContainer: '#1e3a8a',
  onPrimaryContainer: '#bfdbfe',

  secondary: '#64748b',
  onSecondary: '#ffffff',
  secondaryContainer: '#334155',
  onSecondaryContainer: '#cbd5e1',

  tertiary: '#f59e0b',
  onTertiary: '#ffffff',
  tertiaryContainer: '#78350f',
  onTertiaryContainer: '#fde68a',

  error: '#ef4444',
  onError: '#ffffff',
  errorContainer: '#7f1d1d',
  onErrorContainer: '#fecaca',

  background: '#0f172a',
  onBackground: '#f8fafc',
  surface: '#1e293b',
  onSurface: '#f1f5f9',

  surfaceVariant: '#334155',
  onSurfaceVariant: '#cbd5e1',
  outline: '#64748b',
  outlineVariant: '#475569',

  surfaceContainerLowest: '#020617',
  surfaceContainerLow: '#0f172a',
  surfaceContainer: '#1e293b',
  surfaceContainerHigh: '#334155',
  surfaceContainerHighest: '#475569',
  surfaceDim: '#020617',
};

// Platform-aware shadows:
//  • Web (react-native-web ≥0.20): only boxShadow is accepted (shadow* props are deprecated)
//  • Native (iOS/Android): shadow* props + elevation
export const Shadows = {
  soft: Platform.select({
    web: { boxShadow: '0px 10px 20px rgba(0, 65, 143, 0.08)' },
    default: {
      shadowColor: '#00418f',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 3,
    },
  }),
  medium: Platform.select({
    web: { boxShadow: '0px 15px 25px rgba(0, 65, 143, 0.10)' },
    default: {
      shadowColor: '#00418f',
      shadowOffset: { width: 0, height: 15 },
      shadowOpacity: 0.1,
      shadowRadius: 25,
      elevation: 5,
    },
  }),
  glow: Platform.select({
    web: { boxShadow: '0px 8px 15px rgba(0, 65, 143, 0.25)' },
    default: {
      shadowColor: '#00418f',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 8,
    },
  }),
  strong: Platform.select({
    web: { boxShadow: '0px 20px 40px rgba(0, 0, 0, 0.2)' },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.2,
      shadowRadius: 40,
      elevation: 12,
    },
  }),
};

export const Typography = {
  fontFamily: 'PlusJakartaSans',
  heading: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5 },
  body: { fontFamily: 'PlusJakartaSans_500Medium' },
  label: { fontFamily: 'PlusJakartaSans_700Bold', tracking: 1 },
};
