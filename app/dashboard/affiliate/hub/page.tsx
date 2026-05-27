import type { Metadata } from "next"
import { Suspense } from "react"

import { AffiliateSwipeFeed } from "@/components/affiliate/swipe-feed/affiliate-swipe-feed"
import { requireAffiliateSession } from "@/lib/dashboard-session"

export const dynamic = "force-dynamic"
export const revalidate = 0

export const metadata: Metadata = {
  title: "Hub affilié — Swipe Feed | Affisell",
  description: "Découvrez et listez des produits en mode Swipe Feed.",
  robots: { index: false, follow: false },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AffiliateHubPage({ searchParams }: PageProps) {
  await requireAffiliateSession("/dashboard/affiliate/hub")

  const sp = await searchParams
  const modeRaw = typeof sp.mode === "string" ? sp.mode : Array.isArray(sp.mode) ? sp.mode[0] : ""
  const initialMode = modeRaw === "swipe" ? "swipe" : "hub"

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-3.75rem)] items-center justify-center bg-zinc-950 text-zinc-500">
          Chargement du hub…
        </div>
      }
    >
      <AffiliateSwipeFeed initialMode={initialMode} />
    </Suspense>
  )
}
