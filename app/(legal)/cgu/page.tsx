import type { Metadata } from "next"

import {
  generateLocalizedLegalMetadata,
  LocalizedLegalPage,
} from "@/components/legal/localized-legal-page"

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedLegalMetadata("terms-of-service")
}

export default function CguPage() {
  return <LocalizedLegalPage slug="terms-of-service" />
}
