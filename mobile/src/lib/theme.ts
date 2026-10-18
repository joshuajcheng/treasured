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
};

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
};
