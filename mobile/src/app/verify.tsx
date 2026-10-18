import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Body, Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const CODE_LENGTH = 6;

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify(token: string) {
    setVerifying(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setVerifying(false);

    // On success there's nothing to do here: the new session flips the
    // guards in _layout.tsx, which moves the user to the next screen.
    if (error) {
      setError(error.message);
      setCode('');
    }
  }

  function onChangeCode(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) verify(digits);
  }

  async function resend() {
    setResending(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setResending(false);
    if (error) setError(error.message);
    else setMessage('A new code is on its way.');
  }

  return (
    <Screen>
      <Title>Check your email</Title>
      <Body muted>Enter the 6-digit code we sent to {email}.</Body>

      <TextField
        value={code}
        onChangeText={onChangeCode}
        placeholder="123456"
        keyboardType="number-pad"
        // Lets iOS offer the code from Mail above the keyboard.
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        autoFocus
        editable={!verifying}
        style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
      />
      {error && <ErrorText>{error}</ErrorText>}
      {message && <Body muted>{message}</Body>}

      <Button
        label="Verify"
        onPress={() => verify(code)}
        disabled={code.length !== CODE_LENGTH}
        loading={verifying}
      />
      <Button label="Send a new code" variant="link" onPress={resend} loading={resending} />
      <Button label="Use a different email" variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
