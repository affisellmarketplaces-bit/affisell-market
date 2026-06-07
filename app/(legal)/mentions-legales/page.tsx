import type { Metadata } from "next"

import {
  generateLocalizedLegalMetadata,
  LocalizedLegalPage,
} from "@/components/legal/localized-legal-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedLegalMetadata("mentions")
}

export default function MentionsLegalesPage() {
  return <LocalizedLegalPage slug="mentions" />
}
