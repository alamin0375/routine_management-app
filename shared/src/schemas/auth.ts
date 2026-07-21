import { z } from 'zod';

// Contracts for /api/v1/auth/* and /api/v1/me (TECHNICAL_ARCHITECTURE.md §5, §7).
// The refresh token never appears in these payloads — it travels only in an
// httpOnly cookie; responses carry the short-lived access token.

export const signupRequestSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be at most 128 characters.'),
  timezone: z
    .string()
    .min(1, 'Timezone is required.')
    .refine(
      (tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Timezone must be a valid IANA name (e.g. "Asia/Dhaka").' },
    ),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  timezone: z.string(),
  plan: z.enum(['FREE', 'PREMIUM']),
  createdAt: z.string(), // ISO 8601
});
export type User = z.infer<typeof userSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const updateMeRequestSchema = z
  .object({
    timezone: signupRequestSchema.shape.timezone,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update.',
  });
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

// Consistent error envelope (§7): machine-readable code + human message.
// Validation failures (400 VALIDATION_ERROR) additionally carry per-field
// details; message stays the first issue for backward compatibility.
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(
        z.object({
          path: z.string(), // dotted field path, e.g. "timezone" or "tasks.0.title"
          message: z.string(),
        }),
      )
      .optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
