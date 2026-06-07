import type { Metadata } from "next"

import {
  generateLocalizedLegalMetadata,
  LocalizedLegalPage,
} from "@/components/legal/localized-legal-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedLegalMetadata("refund-policy")
}

export default function ReturnsPage() {
  return <LocalizedLegalPage slug="refund-policy" />
}
