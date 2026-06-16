import { Suspense } from "react"
import { redirect } from "next/navigation"

import { AdminExpansionConsole } from "@/components/admin/admin-expansion-console"
import { loadAdminExpansionOverview } from "@/lib/admin/load-admin-expansion-overview"
import { buildMetabaseExpansionBounceEmbedUrl, buildMetabaseExpansionEmailKindEmbedUrl, buildMetabaseExpansionEmbedUrl } from "@/lib/sentinel/metabase-embed"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminExpansionPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/expansion")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const initial = await loadAdminExpansionOverview()
  const metabaseExpansionEmbedUrl = buildMetabaseExpansionEmbedUrl()
  const metabaseExpansionBounceEmbedUrl = buildMetabaseExpansionBounceEmbedUrl()
  const metabaseExpansionEmailKindEmbedUrl = buildMetabaseExpansionEmailKindEmbedUrl()

  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="h-96 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
        </main>
      }
    >
      <AdminExpansionConsole
        initial={initial}
        metabaseExpansionEmbedUrl={metabaseExpansionEmbedUrl}
        metabaseExpansionBounceEmbedUrl={metabaseExpansionBounceEmbedUrl}
        metabaseExpansionEmailKindEmbedUrl={metabaseExpansionEmailKindEmbedUrl}
      />
    </Suspense>
  )
}
