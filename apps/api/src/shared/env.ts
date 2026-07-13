import { z } from "zod"

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().optional(),

  CLERK_SECRET_KEY: z.string().min(1),

  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  // TikTok OAuth
  TIKTOK_CLIENT_KEY: z.string().min(1),
  TIKTOK_CLIENT_SECRET: z.string().min(1),
  TIKTOK_REDIRECT_URI: z
    .string()
    .url()
    .default("https://verify.affisell.com/auth/tiktok/callback"),

  // Allow overriding endpoints without code changes (TikTok APIs evolve quickly).
  TIKTOK_AUTH_URL: z
    .string()
    .url()
    .default("https://auth.tiktok-shops.com/oauth/authorize"),
  TIKTOK_TOKEN_URL: z
    .string()
    .url()
    .default("https://open.tiktokapis.com/v2/oauth/token/"),
  TIKTOK_SHOP_INFO_URL: z.string().url().optional(),

  // Encryption key for token-at-rest (AES-256-GCM), 32 bytes hex.
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),

  // Prisma datasource for Market Intelli DB.
  MARKET_INTELLI_DATABASE_URL: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

