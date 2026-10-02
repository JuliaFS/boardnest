import { describe, expect, it, vi } from 'vitest';

import {
  createGuestAdmission,
  guestAdmissionLimits,
} from './guest-admission.js';

type EvalScript = (
  script: string,
  options: { arguments: string[]; keys: string[] },
) => Promise<unknown>;

describe('guest admission limiter', () => {
  it('hashes the IP and passes all limits to one atomic Redis script', async () => {
    const evalScript = vi.fn<EvalScript>().mockResolvedValue(0);
    const admission = createGuestAdmission({
      client: {
        close: vi.fn().mockResolvedValue(undefined),
        eval: evalScript,
      },
      now: () => Date.UTC(2026, 0, 2, 3, 4, 5),
      secret: 'a'.repeat(32),
    });

    const decision = await admission.consume('203.0.113.8');
    expect(decision.allowed).toBe(true);
    if (!decision.allowed)
      throw new Error('Expected an admission reservation.');
    expect(decision.reservation).toContain('boardnest:v1:guest:global:day:');
    const options = evalScript.mock.calls[0]?.[1];
    if (!options) throw new Error('Expected the Redis script to be called.');
    expect(options.arguments.slice(0, 3)).toEqual([
      String(guestAdmissionLimits.perIpPerHour),
      String(guestAdmissionLimits.perIpPerDay),
      String(guestAdmissionLimits.globalPerDay),
    ]);
    expect(options.keys).toHaveLength(3);
    expect(options.keys.join(':')).not.toContain('203.0.113.8');
  });

  it('releases only a validated global reservation', async () => {
    const evalScript = vi.fn<EvalScript>().mockResolvedValue(0);
    const admission = createGuestAdmission({
      client: {
        close: vi.fn().mockResolvedValue(undefined),
        eval: evalScript,
      },
      secret: 'c'.repeat(32),
    });

    await admission.release('boardnest:v1:guest:global:day:20724');

    expect(evalScript).toHaveBeenCalledWith(expect.any(String), {
      arguments: [],
      keys: ['boardnest:v1:guest:global:day:20724'],
    });
    await expect(admission.release('untrusted-key')).rejects.toThrow(
      'Invalid guest admission reservation.',
    );
  });

  it('returns the remaining window when an IP limit is reached', async () => {
    const admission = createGuestAdmission({
      client: {
        close: vi.fn().mockResolvedValue(undefined),
        eval: vi.fn().mockResolvedValue(1),
      },
      now: () => Date.UTC(2026, 0, 2, 3, 30),
      secret: 'b'.repeat(32),
    });

    await expect(admission.consume('198.51.100.2')).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1801,
    });
  });
});
