import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase config. Copy mobile/.env.example to mobile/.env and fill in your project URL and key.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Keeps the user signed in after the app is closed.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // We sign in with a code, not a link, so there's never a session in a URL.
    detectSessionInUrl: false,
  },
});

// Only refresh the session token while the app is on screen.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
