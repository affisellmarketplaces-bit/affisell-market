import { z } from "zod"

export const tryOnAngleSchema = z.enum(["front"])

export const tryOnCreateBodySchema = z.object({
  productId: z.string().min(1),
  affiliateProductId: z.string().min(1).optional(),
  inputUrl: z.string().url().max(2048),
  angle: tryOnAngleSchema.default("front"),
  gdprConsent: z.literal(true),
  consentVersion: z.string().min(1).max(32),
})

export const tryOnStatusQuerySchema = z.object({
  jobId: z.string().min(1),
})

export type TryOnCreateBody = z.infer<typeof tryOnCreateBodySchema>
