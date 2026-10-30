export const MIN_TOUCH_TARGET = 48;

export const theme = {
  colors: {
    background: '#070b18',
    surface: '#11182b',
    surfaceElevated: '#18213a',
    border: '#2b385a',
    primary: '#8ea2ff',
    primaryContrast: '#07102b',
    text: '#f8faff',
    textMuted: '#aab5d1',
    success: '#55d6a2',
    danger: '#ff8fa3',
    warning: '#f8c86a',
    overlay: 'rgba(2, 5, 14, 0.76)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 18,
    pill: 999,
  },
  typography: {
    body: 16,
    bodyLineHeight: 24,
    caption: 13,
    heading: 28,
    title: 36,
  },
} as const;

export type BoardnestTheme = typeof theme;
