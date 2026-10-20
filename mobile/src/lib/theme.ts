import { Platform } from 'react-native';

// Placeholder palette until the visual design pass: warm paper, ink, and a muted olive.
export const colors = {
  background: '#FAF7F2',
  text: '#2B2622',
  muted: '#7A7068',
  border: '#E2DBD0',
  accent: '#5B6B4F',
  onAccent: '#FFFFFF',
  error: '#A3402F',
  typo: '#D9A421',
  errorBackground: '#F7DEDA',
  highlight: '#EEF0E8',
};

/** Greens for the sheen on correct words, light and deep in turn. */
export const sheen = ['#2E6A45', '#448C56', '#2E6A45', '#4F975C', '#2E6A45', '#448C56'] as const;

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
};
