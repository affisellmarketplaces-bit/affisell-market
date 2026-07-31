import type { Metadata } from "next"

import {
  generateLocalizedLegalMetadata,
  LocalizedLegalPage,
} from "@/components/legal/localized-legal-page"
import { TERMS_OF_SALE_SLUG } from "@/lib/legal/localized-content"

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedLegalMetadata(TERMS_OF_SALE_SLUG)
}

/** Canonical CGV — LMS `terms-of-sale` (also served historically at `/cgv`, redirected here). */
export default function LegalCgvPage() {
  return <LocalizedLegalPage slug={TERMS_OF_SALE_SLUG} />
}
