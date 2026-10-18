import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/lib/theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function TextField(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'link';
};

export function Button({ label, onPress, disabled, loading, variant = 'primary' }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'link' && styles.link,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' && styles.primaryLabel,
            variant === 'link' && styles.linkLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 16 },
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.text },
  body: { fontSize: 16, lineHeight: 22, color: colors.text },
  muted: { color: colors.muted },
  error: { fontSize: 14, color: colors.error },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    // Set explicitly: iOS can reuse a native text field from another screen
    // (e.g. the spaced-out code field) and keep its letter spacing otherwise.
    letterSpacing: 0,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.accent },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' },
  link: { paddingVertical: 8 },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  buttonLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  primaryLabel: { color: colors.onAccent },
  linkLabel: { fontWeight: '500', color: colors.muted },
});
