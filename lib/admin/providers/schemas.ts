import {
  FulfillmentPaymentMethod,
  FulfillmentProviderStatus,
  SupplierChannelType,
} from "@prisma/client"
import { z } from "zod"

export const providerCredentialsSchema = z.object({
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
})

export const providerFormSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.nativeEnum(SupplierChannelType),
  apiEndpoint: z.union([z.string().url(), z.literal("")]).optional(),
  paymentMethod: z.nativeEnum(FulfillmentPaymentMethod),
  credentials: providerCredentialsSchema.optional(),
})

export type ProviderFormValues = z.infer<typeof providerFormSchema>

export const sealKeysSchema = z.object({
  apiKey: z.string().min(1).max(500).optional(),
  apiSecret: z.string().min(1).max(500).optional(),
}).refine((c) => Boolean(c.apiKey?.trim() || c.apiSecret?.trim()), {
  message: "At least one of apiKey or apiSecret is required",
})

export const providerPatchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  type: z.nativeEnum(SupplierChannelType).optional(),
  apiEndpoint: z.union([z.string().url(), z.literal("")]).optional(),
  paymentMethod: z.nativeEnum(FulfillmentPaymentMethod).optional(),
  status: z.nativeEnum(FulfillmentProviderStatus).optional(),
})
