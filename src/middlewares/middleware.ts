import { z } from 'zod';
import type { Context } from 'hono';

export const signupSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  department: z.string().min(2).nullable().optional(),
  userType: z.enum(['ADMIN', 'HEAD', 'STAFF']),
  avatar: z.string().url().or(z.string().startsWith('data:image/')).optional().nullable(),
});

export const validateSignup = async (c: Context, next: Function) => {
  try {
    const body = await c.req.json();
    signupSchema.parse(body);
    await next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    return c.json({ error: 'Validation failed', details: error }, 400);
  }
};