import { useState } from 'react';

import { Body, Button, ErrorText, Screen, TextField, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Name() {
  const { session, reloadProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const first = firstName.trim();
  const last = lastName.trim();

  async function save() {
    if (!session) return;
    setSaving(true);
    setError(null);
    // RLS only allows this insert when id matches the signed-in user.
    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      first_name: first,
      last_name: last,
    });

    if (error) {
      setSaving(false);
      setError("Couldn't save your name. Check your connection and try again.");
      return;
    }
    // Loading the new profile flips the guards in _layout.tsx to the home screen.
    await reloadProfile();
  }

  return (
    <Screen>
      <Title>What should we call you?</Title>
      <Body muted>This is just how your name appears in Treasured.</Body>

      <TextField
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        autoComplete="given-name"
        textContentType="givenName"
        autoFocus
        maxLength={50}
      />
      <TextField
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last name"
        autoComplete="family-name"
        textContentType="familyName"
        maxLength={50}
        returnKeyType="done"
        onSubmitEditing={() => first && last && save()}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button label="Continue" onPress={save} disabled={!first || !last} loading={saving} />
    </Screen>
  );
}
