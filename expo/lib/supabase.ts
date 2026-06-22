import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Public client-side values: the anon / "publishable" key is designed to ship in the
// app bundle, and all data access is gated by Row Level Security. Env vars override
// these (for local dev / other projects), but the fallback guarantees the app boots
// even where env vars weren't configured (e.g. the Vercel build).
// Use `||` (not `??`) so a blank/empty env var also falls back to these public values.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bvmgedwwsjeksvykzwak.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_UwuhlnTg3IHmA0eHb9QE5w_ClwtZAR7';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
