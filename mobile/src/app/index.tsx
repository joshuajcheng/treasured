import { Body, Button, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Home. For now it only holds the "set your first goal" placeholder;
// verse selection comes in a later step.
export default function Home() {
  const { profile } = useAuth();

  return (
    <Screen>
      <Title>Welcome, {profile?.first_name}</Title>
      <Body>Set your first goal</Body>
      <Body muted>Choosing a verse to memorize is coming soon.</Body>
      <Button label="Sign out" variant="link" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
