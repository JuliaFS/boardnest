import { createHmac } from 'node:crypto';

import { createClient } from 'redis';

export const guestAdmissionLimits = {
  globalPerDay: 100,
  perIpPerDay: 10,
  perIpPerHour: 3,
} as const;

export type GuestAdmissionDecision =
  | { allowed: true; reservation: string }
  | { allowed: false; retryAfterSeconds: number };

export interface GuestAdmission {
  close: () => Promise<void>;
  consume: (clientIp: string) => Promise<GuestAdmissionDecision>;
  release: (reservation: string) => Promise<void>;
}

interface GuestRateClient {
  close: () => Promise<void>;
  eval: (
    script: string,
    options: { arguments: string[]; keys: string[] },
  ) => Promise<unknown>;
}

interface GuestAdmissionOptions {
  client: GuestRateClient;
  now?: () => number;
  secret: string;
}

const releaseScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count > 0 then redis.call('DECR', KEYS[1]) end
return 0
`;

const consumeScript = `
local hour_count = tonumber(redis.call('GET', KEYS[1]) or '0')
local day_count = tonumber(redis.call('GET', KEYS[2]) or '0')
local global_count = tonumber(redis.call('GET', KEYS[3]) or '0')

if hour_count >= tonumber(ARGV[1]) then return 1 end
if day_count >= tonumber(ARGV[2]) then return 2 end
if global_count >= tonumber(ARGV[3]) then return 3 end

local next_hour = redis.call('INCR', KEYS[1])
local next_day = redis.call('INCR', KEYS[2])
local next_global = redis.call('INCR', KEYS[3])

if next_hour == 1 then redis.call('EXPIRE', KEYS[1], ARGV[4]) end
if next_day == 1 then redis.call('EXPIRE', KEYS[2], ARGV[5]) end
if next_global == 1 then redis.call('EXPIRE', KEYS[3], ARGV[5]) end

return 0
`;

export async function createRedisGuestAdmission(
  url: string,
  secret: string,
): Promise<GuestAdmission> {
  const client = createClient({ url });
  client.on('error', (error) =>
    console.error('Guest limiter Redis error', error),
  );
  try {
    await client.connect();
  } catch (error) {
    client.destroy();
    throw error;
  }

  return createGuestAdmission({
    client,
    secret,
  });
}

export function createGuestAdmission({
  client,
  now = Date.now,
  secret,
}: GuestAdmissionOptions): GuestAdmission {
  return {
    close: () => client.close(),

    async consume(clientIp) {
      const currentTime = now();
      const hour = Math.floor(currentTime / 3_600_000);
      const day = Math.floor(currentTime / 86_400_000);
      const secondsToHourEnd =
        Math.floor(((hour + 1) * 3_600_000 - currentTime) / 1000) + 1;
      const secondsToDayEnd =
        Math.floor(((day + 1) * 86_400_000 - currentTime) / 1000) + 1;
      const ipHash = createHmac('sha256', secret)
        .update(clientIp)
        .digest('hex');
      const globalKey = `boardnest:v1:guest:global:day:${day}`;
      const result = Number(
        await client.eval(consumeScript, {
          arguments: [
            String(guestAdmissionLimits.perIpPerHour),
            String(guestAdmissionLimits.perIpPerDay),
            String(guestAdmissionLimits.globalPerDay),
            String(secondsToHourEnd),
            String(secondsToDayEnd),
          ],
          keys: [
            `boardnest:v1:guest:ip:${ipHash}:hour:${hour}`,
            `boardnest:v1:guest:ip:${ipHash}:day:${day}`,
            globalKey,
          ],
        }),
      );

      if (result === 0) return { allowed: true, reservation: globalKey };
      return {
        allowed: false,
        retryAfterSeconds: result === 1 ? secondsToHourEnd : secondsToDayEnd,
      };
    },

    async release(reservation) {
      if (!reservation.startsWith('boardnest:v1:guest:global:day:')) {
        throw new Error('Invalid guest admission reservation.');
      }
      await client.eval(releaseScript, { arguments: [], keys: [reservation] });
    },
  };
}
