import type { ListingKind } from "@/lib/supplier-commission"

export type DigitalDeliveryProductFields = {
  listingKind: string
  digitalAccessUrl: string | null
  digitalAccessInstructions: string | null
  digitalInstantDelivery: boolean
  name: string
}

export type ParsedDigitalDeliveryInput = {
  digitalAccessUrl: string | null
  digitalAccessInstructions: string | null
  digitalInstantDelivery: boolean
}

export type DigitalAccessPlaceholders = {
  orderId: string
  token: string
  email: string
}

export function isDigitalListingKind(kind: string | ListingKind | null | undefined): boolean {
  const k = typeof kind === "string" ? kind.trim().toUpperCase() : ""
  return k === "SOFTWARE" || k === "SUBSCRIPTION"
}
