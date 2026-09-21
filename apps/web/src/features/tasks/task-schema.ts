import { z } from 'zod';

export const taskFormSchema = z.object({
  description: z.string().max(50_000),
  dueAt: z.string(),
  priority: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  title: z.string().trim().min(1, 'Task title is required.').max(240),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;
