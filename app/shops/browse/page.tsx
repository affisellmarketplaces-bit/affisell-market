import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Marketplace — Affisell",
  description: "Parcourez les annonces des boutiques créateurs Affisell.",
  robots: { index: true, follow: true },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy URL — same explorer as home with filters in query string. */
export default async function CustomerMarketplaceBrowsePage({ searchParams }: PageProps) {
  const raw = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value)
    else if (Array.isArray(value) && value[0]) params.set(key, value[0])
  }
  const qs = params.toString()
  redirect(qs ? `/?${qs}#explorer` : "/#explorer")
}
