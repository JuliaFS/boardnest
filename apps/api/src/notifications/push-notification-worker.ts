import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

interface RpcClient {
  rpc: (
    name: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface PushRunResult {
  claimed: number;
  delivered: number;
  failed: number;
  tickets: number;
}

export interface PushNotificationWorker {
  close: () => Promise<void>;
  runOnce: () => Promise<PushRunResult>;
  start: () => void;
}

type WorkerOptions = {
  accessToken?: string;
  batchSize: number;
  client: RpcClient;
  fetchImplementation?: typeof fetch;
  intervalMs: number;
  onError?: (error: unknown) => void;
};

const claimedSchema = z.object({
  attempt_count: z.number().int().positive(),
  device_id: z.uuid(),
  id: z.uuid(),
  lock_token: z.uuid(),
  max_attempts: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
  push_token: z.string().min(1),
});
const receiptClaimSchema = z.object({
  device_id: z.uuid(),
  id: z.uuid(),
  lock_token: z.uuid(),
  ticket_id: z.string().min(1),
});

export function createSupabasePushNotificationWorker(options: {
  accessToken?: string;
  batchSize: number;
  intervalMs: number;
  serviceRoleKey: string;
  supabaseUrl: string;
}): PushNotificationWorker {
  return createPushNotificationWorker({
    ...options,
    client: createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  });
}

export function createPushNotificationWorker({
  accessToken,
  batchSize,
  client,
  fetchImplementation = fetch,
  intervalMs,
  onError = (error) => console.error('Push notification worker error', error),
}: WorkerOptions): PushNotificationWorker {
  let activeRun: Promise<PushRunResult> | null = null;
  let closed = false;
  let timer: NodeJS.Timeout | null = null;

  const runOnce = () => {
    if (closed)
      return Promise.reject(new Error('Push notification worker is closed.'));
    if (activeRun) return activeRun;
    activeRun = processPushBatch(
      client,
      fetchImplementation,
      batchSize,
      accessToken,
    ).finally(() => {
      activeRun = null;
    });
    return activeRun;
  };

  const tick = () => void runOnce().catch(onError);
  return {
    async close() {
      closed = true;
      if (timer) clearInterval(timer);
      timer = null;
      await activeRun?.catch(() => undefined);
    },
    runOnce,
    start() {
      if (closed) throw new Error('Push notification worker is closed.');
      if (timer) return;
      tick();
      timer = setInterval(tick, intervalMs);
      timer.unref();
    },
  };
}

async function processPushBatch(
  client: RpcClient,
  fetchImplementation: typeof fetch,
  batchSize: number,
  accessToken?: string,
): Promise<PushRunResult> {
  const result: PushRunResult = {
    claimed: 0,
    delivered: 0,
    failed: 0,
    tickets: 0,
  };
  const claims = await rpcRows(
    client,
    'claim_push_notification_deliveries',
    {
      p_batch_size: batchSize,
    },
    claimedSchema,
  );
  result.claimed = claims.length;

  for (const delivery of claims) {
    try {
      const response = await fetchImplementation(
        'https://exp.host/--/api/v2/push/send',
        {
          body: JSON.stringify(createExpoMessage(delivery)),
          headers: expoHeaders(accessToken),
          method: 'POST',
        },
      );
      if (!response.ok)
        throw new PushError(
          `EXPO_HTTP_${response.status}`,
          await response.text(),
          response.status >= 500,
        );
      const body = z
        .object({
          data: z.object({
            details: z.object({ error: z.string() }).optional(),
            id: z.string().optional(),
            message: z.string().optional(),
            status: z.enum(['ok', 'error']),
          }),
        })
        .parse(await response.json());
      if (body.data.status === 'error') {
        const code = body.data.details?.error ?? 'EXPO_TICKET_ERROR';
        throw new PushError(
          code,
          body.data.message ?? 'Expo rejected the push message.',
          code !== 'DeviceNotRegistered',
        );
      }
      if (!body.data.id)
        throw new PushError(
          'EXPO_TICKET_MISSING',
          'Expo did not return a push ticket.',
          true,
        );
      await rpcBoolean(client, 'record_push_notification_ticket', {
        p_delivery_id: delivery.id,
        p_lock_token: delivery.lock_token,
        p_ticket_id: body.data.id,
      });
      result.tickets += 1;
    } catch (error) {
      const failure = classifyPushError(error);
      await failPush(client, delivery.id, delivery.lock_token, failure);
      result.failed += 1;
    }
  }

  const receipts = await rpcRows(
    client,
    'claim_push_notification_receipts',
    {
      p_batch_size: Math.min(batchSize * 2, 1000),
    },
    receiptClaimSchema,
  );
  if (receipts.length === 0) return result;

  try {
    const response = await fetchImplementation(
      'https://exp.host/--/api/v2/push/getReceipts',
      {
        body: JSON.stringify({
          ids: receipts.map((receipt) => receipt.ticket_id),
        }),
        headers: expoHeaders(accessToken),
        method: 'POST',
      },
    );
    if (!response.ok)
      throw new PushError(
        `EXPO_RECEIPT_HTTP_${response.status}`,
        await response.text(),
        true,
      );
    const parsed = z
      .object({
        data: z.record(
          z.string(),
          z.object({
            details: z.object({ error: z.string() }).optional(),
            message: z.string().optional(),
            status: z.enum(['ok', 'error']),
          }),
        ),
      })
      .parse(await response.json());
    for (const receipt of receipts) {
      const status = parsed.data[receipt.ticket_id];
      if (!status) {
        await releaseReceipt(
          client,
          receipt.id,
          receipt.lock_token,
          'Expo did not return the requested receipt.',
        );
        result.failed += 1;
      } else if (status.status === 'ok') {
        await rpcBoolean(client, 'complete_push_notification_receipt', {
          p_delivery_id: receipt.id,
          p_lock_token: receipt.lock_token,
        });
        result.delivered += 1;
      } else {
        const code = status.details?.error ?? 'EXPO_RECEIPT_ERROR';
        await failPush(client, receipt.id, receipt.lock_token, {
          code,
          message: status.message ?? 'Expo reported a push delivery failure.',
          retryable: ![
            'DeviceNotRegistered',
            'MessageTooBig',
            'InvalidCredentials',
          ].includes(code),
          revokeDevice: code === 'DeviceNotRegistered',
        });
        result.failed += 1;
      }
    }
  } catch (error) {
    const failure = classifyPushError(error);
    for (const receipt of receipts) {
      await releaseReceipt(
        client,
        receipt.id,
        receipt.lock_token,
        failure.message,
      );
      result.failed += 1;
    }
  }
  return result;
}

function createExpoMessage(delivery: z.infer<typeof claimedSchema>) {
  return {
    body:
      readString(delivery.payload.body) ??
      'You have a new Boardnest notification.',
    data: {
      eventType: readString(delivery.payload.eventType),
      notificationId: readString(delivery.payload.notificationId),
      projectId: readString(delivery.payload.projectId),
      taskId: readString(delivery.payload.taskId),
      workspaceId: readString(delivery.payload.workspaceId),
    },
    sound: 'default',
    title: readString(delivery.payload.title) ?? 'Boardnest',
    to: delivery.push_token,
  };
}

function expoHeaders(accessToken?: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

type PushFailure = {
  code: string;
  message: string;
  retryable: boolean;
  revokeDevice?: boolean;
};
class PushError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
function classifyPushError(error: unknown): PushFailure {
  if (error instanceof PushError)
    return {
      code: error.code,
      message: error.message.slice(0, 4000),
      retryable: error.retryable,
      revokeDevice: error.code === 'DeviceNotRegistered',
    };
  return {
    code: 'EXPO_REQUEST_FAILED',
    message:
      error instanceof Error
        ? error.message.slice(0, 4000)
        : 'Expo push request failed.',
    retryable: true,
  };
}
async function failPush(
  client: RpcClient,
  id: string,
  lockToken: string,
  failure: PushFailure,
) {
  await rpcBoolean(client, 'fail_push_notification_delivery', {
    p_delivery_id: id,
    p_error_code: failure.code,
    p_error_message: failure.message,
    p_lock_token: lockToken,
    p_retryable: failure.retryable,
    p_revoke_device: failure.revokeDevice ?? false,
  });
}
async function releaseReceipt(
  client: RpcClient,
  id: string,
  lockToken: string,
  message: string,
) {
  await rpcBoolean(client, 'release_push_notification_receipt', {
    p_delivery_id: id,
    p_error_message: message,
    p_lock_token: lockToken,
  });
}
async function rpcRows<T extends z.ZodType>(
  client: RpcClient,
  name: string,
  parameters: Record<string, unknown>,
  schema: T,
): Promise<z.infer<T>[]> {
  const response = await client.rpc(name, parameters);
  if (response.error)
    throw new Error(`${name} RPC failed: ${response.error.message}`);
  return z.array(schema).parse(response.data);
}
async function rpcBoolean(
  client: RpcClient,
  name: string,
  parameters: Record<string, unknown>,
) {
  const response = await client.rpc(name, parameters);
  if (response.error)
    throw new Error(`${name} RPC failed: ${response.error.message}`);
  if (response.data !== true)
    throw new Error(`${name} did not update the claimed delivery.`);
}
function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
