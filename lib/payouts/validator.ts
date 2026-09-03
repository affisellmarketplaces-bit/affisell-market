import { z } from "zod"

const mobilePhoneSchema = z
  .string()
  .regex(/^(\+221|\+225|\+33)/, "Phone must start with +221, +225, or +33")

const bankPayoutSchema = z.object({
  type: z.literal("BANK"),
  iban: z.string().min(15),
  bic: z.string().min(8),
  holderName: z.string().min(2),
})

const paypalPayoutSchema = z.object({
  type: z.literal("PAYPAL"),
  email: z.email(),
})

const wisePayoutSchema = z.object({
  type: z.literal("WISE"),
  email: z.email(),
})

const payoneerPayoutSchema = z.object({
  type: z.literal("PAYONEER"),
  email: z.email(),
})

const mobileMoneyBaseSchema = z.object({
  phone: mobilePhoneSchema,
  fullName: z.string().min(2),
})

const wavePayoutSchema = mobileMoneyBaseSchema.extend({
  type: z.literal("MOBILE_MONEY_WAVE"),
})

const orangePayoutSchema = mobileMoneyBaseSchema.extend({
  type: z.literal("MOBILE_MONEY_ORANGE"),
})

const mtnPayoutSchema = mobileMoneyBaseSchema.extend({
  type: z.literal("MOBILE_MONEY_MTN"),
})

export const payoutMethodSchema = z.discriminatedUnion("type", [
  bankPayoutSchema,
  paypalPayoutSchema,
  wisePayoutSchema,
  payoneerPayoutSchema,
  wavePayoutSchema,
  orangePayoutSchema,
  mtnPayoutSchema,
])

export type PayoutMethodInput = z.infer<typeof payoutMethodSchema>

export type PayoutMethodDetails = Omit<PayoutMethodInput, "type">

export const affiliatePayoutMethodCreateSchema = z.intersection(
  z.object({
    country: z
      .string()
      .trim()
      .length(2, "country must be ISO 3166-1 alpha-2")
      .transform((v) => v.toUpperCase()),
  }),
  payoutMethodSchema
)

export type AffiliatePayoutMethodCreateInput = z.infer<typeof affiliatePayoutMethodCreateSchema>

/** Accepts flat body or `{ country, type, details }` from dashboard forms. */
export function parseAffiliatePayoutMethodCreateBody(body: unknown): AffiliatePayoutMethodCreateInput {
  if (body && typeof body === "object" && "details" in body) {
    const raw = body as {
      country?: unknown
      type?: unknown
      details?: Record<string, unknown>
    }
    return affiliatePayoutMethodCreateSchema.parse({
      country: raw.country,
      type: raw.type,
      ...(raw.details ?? {}),
    })
  }
  return affiliatePayoutMethodCreateSchema.parse(body)
}

export function payoutDetailsRecord(input: PayoutMethodInput): Record<string, unknown> {
  switch (input.type) {
    case "BANK":
      return { iban: input.iban, bic: input.bic, holderName: input.holderName }
    case "PAYPAL":
    case "WISE":
    case "PAYONEER":
      return { email: input.email }
    case "MOBILE_MONEY_WAVE":
    case "MOBILE_MONEY_ORANGE":
    case "MOBILE_MONEY_MTN":
      return { phone: input.phone, fullName: input.fullName }
    default: {
      const _exhaustive: never = input
      return _exhaustive
    }
  }
}

/** Validates payout payload; strips `type` for encryption storage. */
export function parsePayoutMethodDetails(input: unknown): PayoutMethodInput {
  return payoutMethodSchema.parse(input)
}
