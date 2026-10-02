import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

interface SchedulerRpcClient {
  rpc: (
    name: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

interface ReminderSchedulerOptions {
  batchSize: number;
  client: SchedulerRpcClient;
  intervalMs: number;
  onError?: (error: unknown) => void;
  onProcessed?: (count: number) => void;
}

export interface ReminderScheduler {
  close: () => Promise<void>;
  runOnce: () => Promise<number>;
  start: () => void;
}

const processedCountSchema = z.number().int().nonnegative();

export function createSupabaseReminderScheduler(options: {
  batchSize: number;
  intervalMs: number;
  serviceRoleKey: string;
  supabaseUrl: string;
}): ReminderScheduler {
  const client = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return createReminderScheduler({
    batchSize: options.batchSize,
    client,
    intervalMs: options.intervalMs,
  });
}

export function createReminderScheduler({
  batchSize,
  client,
  intervalMs,
  onError = defaultErrorHandler,
  onProcessed = defaultProcessedHandler,
}: ReminderSchedulerOptions): ReminderScheduler {
  let activeRun: Promise<number> | null = null;
  let closed = false;
  let timer: NodeJS.Timeout | null = null;

  const runOnce = (): Promise<number> => {
    if (closed)
      return Promise.reject(new Error('Reminder scheduler is closed.'));
    if (activeRun) return activeRun;

    activeRun = processDueReminders(client, batchSize).finally(() => {
      activeRun = null;
    });
    return activeRun;
  };

  const tick = async (): Promise<void> => {
    try {
      const count = await runOnce();
      if (count > 0) onProcessed(count);
    } catch (error) {
      onError(error);
    }
  };

  return {
    async close() {
      if (closed) return;
      closed = true;
      if (timer) clearInterval(timer);
      timer = null;
      await activeRun?.catch(() => undefined);
    },

    runOnce,

    start() {
      if (closed) throw new Error('Reminder scheduler is closed.');
      if (timer) return;
      void tick();
      timer = setInterval(() => void tick(), intervalMs);
      timer.unref();
    },
  };
}

async function processDueReminders(
  client: SchedulerRpcClient,
  batchSize: number,
): Promise<number> {
  const response = await client.rpc('process_due_task_reminders', {
    p_batch_size: batchSize,
  });
  if (response.error) {
    throw new Error(`Reminder scheduler RPC failed: ${response.error.message}`);
  }
  return processedCountSchema.parse(response.data);
}

function defaultErrorHandler(error: unknown): void {
  console.error('Reminder scheduler error', error);
}

function defaultProcessedHandler(count: number): void {
  console.info(`Processed ${count} due task reminder(s)`);
}
