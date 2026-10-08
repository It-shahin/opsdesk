import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    PORT: z.coerce.number().int().positive().default(3001),

    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),

    AUTH0_ISSUER_BASE_URL: z.string().url(),
    AUTH0_AUDIENCE: z.string().min(1),

    R2_ENDPOINT: z.string().url(),
    R2_BUCKET: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),

    RESEND_API_KEY: z.string().min(1),
    RESEND_INBOUND_API_KEY: z.string().min(1),
    RESEND_WEBHOOK_SECRET: z.string().min(1),
    EMAIL_FROM_NAME: z.string().min(1),
    EMAIL_FROM_ADDRESS: z.string().email(),
    EMAIL_INBOUND_DOMAIN: z.string().min(1),
  })
  .superRefine((env, context) => {
    // Invalid URLs are already reported by the field validators.
    let webOrigin: URL;
    try {
      webOrigin = new URL(env.WEB_ORIGIN);
    } catch {
      return;
    }

    if (webOrigin.pathname !== '/' || webOrigin.search || webOrigin.hash) {
      context.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message:
          'WEB_ORIGIN must be an origin without a path, query or fragment',
      });
    }

    if (env.NODE_ENV === 'production') {
      for (const [field, message] of [
        ['WEB_ORIGIN', 'WEB_ORIGIN must use HTTPS in production'],
        ['AUTH0_ISSUER_BASE_URL', 'Auth0 issuer must use HTTPS in production'],
        ['R2_ENDPOINT', 'R2 endpoint must use HTTPS in production'],
      ] as const) {
        let url: URL;
        try {
          url = new URL(env[field]);
        } catch {
          continue;
        }
        if (url.protocol !== 'https:') {
          context.addIssue({ code: 'custom', path: [field], message });
        }
      }
    }
  });

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}
