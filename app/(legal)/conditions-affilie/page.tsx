import type { Metadata } from "next"

import {
  generateLocalizedLegalMetadata,
  LocalizedLegalPage,
} from "@/components/legal/localized-legal-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedLegalMetadata("terms-affiliate")
}

export default function ConditionsAffiliePage() {
  return <LocalizedLegalPage slug="terms-affiliate" />
}
