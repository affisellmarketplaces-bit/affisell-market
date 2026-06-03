import type { DemoPersonaKey } from "@/lib/demo/demo-shared"

/** Fixed sandbox identities — never use for real payouts. */
export const DEMO_LAB_EMAIL_BY_PERSONA: Record<DemoPersonaKey, string> = {
  supplier: "demo-supplier@demo.affisell.com",
  affiliate: "demo-affiliate@demo.affisell.com",
  buyer: "demo-buyer@demo.affisell.com",
}

export const DEMO_LAB_TAG = "demo-lab"

export type DemoLabAccountMeta = {
  persona: DemoPersonaKey
  email: string
  displayName: string
  redirectTo: string
}

export const DEMO_LAB_ACCOUNT_META: Record<DemoPersonaKey, DemoLabAccountMeta> = {
  supplier: {
    persona: "supplier",
    email: DEMO_LAB_EMAIL_BY_PERSONA.supplier,
    displayName: "Affisell Demo · Supplier",
    redirectTo: "/dashboard/supplier/supply",
  },
  affiliate: {
    persona: "affiliate",
    email: DEMO_LAB_EMAIL_BY_PERSONA.affiliate,
    displayName: "Affisell Demo · Affiliate",
    redirectTo: "/dashboard/affiliate",
  },
  buyer: {
    persona: "buyer",
    email: DEMO_LAB_EMAIL_BY_PERSONA.buyer,
    displayName: "Affisell Demo · Buyer",
    redirectTo: "/marketplace/account",
  },
}

export function isDemoLabEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return Object.values(DEMO_LAB_EMAIL_BY_PERSONA).includes(normalized)
}
