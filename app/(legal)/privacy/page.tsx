import type { Metadata } from "next"

import {
  generateLocalizedLegalMetadata,
  LocalizedLegalPage,
} from "@/components/legal/localized-legal-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedLegalMetadata("privacy-policy")
}

export default function PrivacyPage() {
  return <LocalizedLegalPage slug="privacy-policy" />
}
