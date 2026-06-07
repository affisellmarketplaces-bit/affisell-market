import type { Metadata } from "next"

import { CookiesSettingsClient } from "@/components/cookies/cookies-settings-client"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import {
  generateLocalizedLegalMetadata,
  LocalizedLegalPage,
} from "@/components/legal/localized-legal-page"
import { loadLocalizedLegalDocumentForRequest } from "@/lib/legal/localized-content"

export async function generateMetadata(): Promise<Metadata> {
  return generateLocalizedLegalMetadata("cookies-policy")
}

export default async function CookiesPage() {
  const doc = await loadLocalizedLegalDocumentForRequest("cookies-policy")

  return (
    <LocalizedLegalPage slug="cookies-policy">
      <LegalMarkdown content={doc.content} />
      <div className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <CookiesSettingsClient />
      </div>
    </LocalizedLegalPage>
  )
}
