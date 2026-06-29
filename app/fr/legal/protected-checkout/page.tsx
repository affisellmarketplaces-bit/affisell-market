import { redirect } from "next/navigation"

import { EU_LEGAL_ALIAS_TARGETS } from "@/lib/legal/eu-legal-alias-targets"

/** Alias EU → page canonique B2C. */
export default function EuLegalProtectedCheckoutAliasPage() {
  redirect(EU_LEGAL_ALIAS_TARGETS["protected-checkout"])
}
