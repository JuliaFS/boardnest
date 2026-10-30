import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { mobileEnvironment } from './environment';
import { mobileSessionStorage } from './secure-storage';

export const mobileSupabase = createClient(
  mobileEnvironment.supabaseUrl,
  mobileEnvironment.supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
      storage: mobileSessionStorage,
    },
  },
);
