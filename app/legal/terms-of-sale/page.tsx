import { redirect } from "next/navigation"

import { EU_LEGAL_ALIAS_TARGETS } from "@/lib/legal/eu-legal-alias-targets"

/** Alias EU → page canonique (/cgv). */
export default function EuLegalTermsOfSaleAliasPage() {
  redirect(EU_LEGAL_ALIAS_TARGETS["terms-of-sale"])
}
