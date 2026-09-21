import { describe, expect, it } from 'vitest';

import { clearLegacySupabaseAuthStorage } from './legacy-storage';

describe('legacy browser auth storage migration', () => {
  it('removes old Supabase auth tokens without touching unrelated data', () => {
    localStorage.setItem('sb-project-auth-token', 'sensitive-session');
    localStorage.setItem('boardnest-preference', 'compact');

    clearLegacySupabaseAuthStorage(localStorage);

    expect(localStorage.getItem('sb-project-auth-token')).toBeNull();
    expect(localStorage.getItem('boardnest-preference')).toBe('compact');
  });
});
