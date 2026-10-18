import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  // True only until the saved session (and its profile) has been checked at launch.
  loading: boolean;
  profileError: string | null;
  reloadProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const PROFILE_ERROR = "Couldn't load your profile. Check your connection and try again.";

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  return { profile: error ? null : data, error: error ? PROFILE_ERROR : null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Fires once with the saved session (INITIAL_SESSION), then on every sign-in, sign-out and token refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newUserId = newSession?.user.id ?? null;

      // Same user (e.g. a token refresh): just keep the fresh session.
      if (newUserId === userIdRef.current) {
        setSession(newSession);
        setLoading(false);
        return;
      }

      userIdRef.current = newUserId;
      if (!newUserId) {
        setSession(null);
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      // A different user signed in. Look up their profile first, then publish the
      // session and profile together, so screens never see "signed in, no profile yet"
      // for a returning user. (Deferred because Supabase advises against awaiting
      // other Supabase calls inside this callback.)
      setTimeout(async () => {
        const result = await fetchProfile(newUserId);
        if (userIdRef.current !== newUserId) return; // signed out or switched meanwhile
        setSession(newSession);
        setProfile(result.profile);
        setProfileError(result.error);
        setLoading(false);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const reloadProfile = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    const result = await fetchProfile(userId);
    if (userIdRef.current !== userId) return;
    setProfile(result.profile);
    setProfileError(result.error);
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileError, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
