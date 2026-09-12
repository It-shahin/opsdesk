import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  AUTH0_ISSUER_BASE_URL: z.string().url(),
  AUTH0_AUDIENCE: z.string().min(1),
});

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}