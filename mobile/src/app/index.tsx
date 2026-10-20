import { router } from 'expo-router';

import { Body, Button, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { SAMPLE_PASSAGES } from '@/lib/practice/samples';
import { supabase } from '@/lib/supabase';

// Home. For now it holds the "set your first goal" placeholder and sample
// passages for trying typing practice; verse selection comes in a later step.
export default function Home() {
  const { profile } = useAuth();

  return (
    <Screen>
      <Title>Welcome, {profile?.first_name}</Title>
      <Body>Set your first goal</Body>
      <Body muted>Choosing a verse to memorize is coming soon. Meanwhile, try typing practice:</Body>
      {SAMPLE_PASSAGES.map((passage) => (
        <Button
          key={passage.id}
          label={passage.reference}
          variant="secondary"
          onPress={() => router.push({ pathname: '/practice', params: { passage: passage.id } })}
        />
      ))}
      <Button label="Sign out" variant="link" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
