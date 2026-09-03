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

/** Validates payout payload; strips `type` for encryption storage. */
export function parsePayoutMethodDetails(input: unknown): PayoutMethodInput {
  return payoutMethodSchema.parse(input)
}
