import { createClient } from '@supabase/supabase-js';

import { publicEnvironment } from './env';

export const supabase = createClient(
  publicEnvironment.VITE_SUPABASE_URL,
  publicEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  },
);
