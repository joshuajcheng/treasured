import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = email.trim().toLowerCase();
  const valid = EMAIL_PATTERN.test(trimmed);

  async function sendCode() {
    setSending(true);
    setError(null);
    // The same call signs in existing users and creates new ones,
    // so one email box serves both.
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setSending(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.push({ pathname: '/verify', params: { email: trimmed } });
  }

  return (
    <Screen>
      <View style={styles.brand}>
        {/* Logo placeholder until the visual design pass. */}
        <View style={styles.logo} />
        <Text style={styles.name}>Treasured</Text>
        <Text style={styles.motto}>Treasure His word in your heart</Text>
      </View>

      <Title>Sign in or create an account</Title>
      <Body muted>Enter your email and we'll send you a 6-digit code.</Body>

      <TextField
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => valid && sendCode()}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Continue" onPress={sendCode} disabled={!valid} loading={sending} />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Wired up in step 2. */}
      <Button label="Continue with Google" variant="secondary" onPress={() => {}} disabled />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: 6, marginBottom: 24 },
  logo: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.border },
  name: { fontFamily: fonts.serif, fontSize: 34, color: colors.text },
  motto: { fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 16, color: colors.muted },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { color: colors.muted },
});
