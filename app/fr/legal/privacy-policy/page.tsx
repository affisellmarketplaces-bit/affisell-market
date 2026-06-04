import { redirect } from "next/navigation"

import { EU_LEGAL_ALIAS_TARGETS } from "@/lib/legal/eu-legal-alias-targets"

/** Alias EU → page canonique (/privacy). */
export default function EuLegalPrivacyPolicyAliasPage() {
  redirect(EU_LEGAL_ALIAS_TARGETS["privacy-policy"])
}
