import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const registerSchema = z
  .object({
    confirmPassword: z.string(),
    displayName: z
      .string()
      .trim()
      .min(2, 'Display name must be at least 2 characters.')
      .max(80, 'Display name must be at most 80 characters.'),
    email: z.email('Enter a valid email address.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[a-z]/, 'Password must contain a lowercase letter.')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
      .regex(/[0-9]/, 'Password must contain a number.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
