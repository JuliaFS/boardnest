import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardnestDataService } from './data-service.js';

const supabase = vi.hoisted(() => {
  const builder = {
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
  };
  return {
    builder,
    from: vi.fn(),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: supabase.from }),
}));

const userId = '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8';

describe('Boardnest data service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue(supabase.builder);
    supabase.builder.select.mockReturnValue(supabase.builder);
    supabase.builder.eq.mockReturnValue(supabase.builder);
  });

  it('performs an exact head-only unread count for one user', async () => {
    supabase.builder.is.mockResolvedValue({
      count: 4,
      data: null,
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.unreadNotificationCount(userId)).resolves.toBe(4);

    expect(supabase.from).toHaveBeenCalledWith('notifications');
    expect(supabase.builder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(supabase.builder.eq).toHaveBeenCalledWith('user_id', userId);
    expect(supabase.builder.is).toHaveBeenCalledWith('read_at', null);
  });

  it('returns a sanitized error when the unread count fails', async () => {
    supabase.builder.is.mockResolvedValue({
      count: null,
      data: null,
      error: { message: 'Count failed' },
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.unreadNotificationCount(userId)).rejects.toThrow(
      'The database operation failed.',
    );
  });
});
