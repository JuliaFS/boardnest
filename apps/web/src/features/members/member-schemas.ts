import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address.')),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;
