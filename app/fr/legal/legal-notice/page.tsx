import { redirect } from "next/navigation"

import { EU_LEGAL_ALIAS_TARGETS } from "@/lib/legal/eu-legal-alias-targets"

/** Alias EU → page canonique (/mentions-legales). */
export default function EuLegalLegalNoticeAliasPage() {
  redirect(EU_LEGAL_ALIAS_TARGETS["legal-notice"])
}
