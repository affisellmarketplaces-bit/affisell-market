import type { Metadata } from "next"

import {
  generateLegalMentionsMetadata,
  LegalMentionsPage,
} from "@/components/legal/legal-mentions-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateLegalMentionsMetadata()
}

/** Mentions légales LCEN — format copiable (huissier / formalités). */
export default function LegalMentionsRoutePage() {
  return <LegalMentionsPage />
}
