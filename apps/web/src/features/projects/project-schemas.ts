import { z } from 'zod';

const optionalDate = z
  .string()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Use a valid date.',
  );

const bulgarianTransliteration: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: 'y',
  ю: 'yu',
  я: 'ya',
};

export function workspaceSlugFromName(name: string): string {
  return [...name.toLocaleLowerCase('bg-BG')]
    .map((character) => bulgarianTransliteration[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

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
