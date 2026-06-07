import type { Metadata } from "next"

import {
  generateLocalizedLegalMetadata,
  LocalizedLegalPage,
} from "@/components/legal/localized-legal-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedLegalMetadata("terms-supplier")
}

export default function ConditionsFournisseurPage() {
  return <LocalizedLegalPage slug="terms-supplier" />
}
