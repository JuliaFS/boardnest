import { z } from 'zod';

const optionalDate = z
  .string()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Use a valid date.',
  );

export const workspaceFormSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required.').max(100),
  slug: z
    .string()
    .trim()
    .min(3, 'Slug must have at least 3 characters.')
    .max(63)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use lowercase letters, numbers, and single hyphens.',
    ),
});

export const projectFormSchema = z
  .object({
    description: z.string().max(10_000),
    dueDate: optionalDate,
    name: z.string().trim().min(1, 'Project name is required.').max(120),
    startDate: optionalDate,
    status: z.enum(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED']),
    visibility: z.enum(['WORKSPACE', 'PRIVATE']),
  })
  .refine(
    ({ dueDate, startDate }) => !dueDate || !startDate || dueDate >= startDate,
    { message: 'Due date cannot be before the start date.', path: ['dueDate'] },
  );

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;
export type ProjectFormValues = z.infer<typeof projectFormSchema>;
