import { redirect } from "next/navigation"

import { EU_LEGAL_ALIAS_TARGETS } from "@/lib/legal/eu-legal-alias-targets"

/** Alias EU → page canonique (/returns). */
export default function EuLegalReturnsAliasPage() {
  redirect(EU_LEGAL_ALIAS_TARGETS["returns"])
}
