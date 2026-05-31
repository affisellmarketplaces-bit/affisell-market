import Link from "next/link"
import { redirect } from "next/navigation"

import { AeBookmarkletInstallPanel } from "@/components/admin/ae-bookmarklet-install-panel"
import { auth } from "@/auth"
import { buildUniversalAeImportBookmarklet } from "@/lib/fulfillment/ae-import-bookmarklet"

export const dynamic = "force-dynamic"

export default async function AeBookmarkletAdminPage() {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    redirect("/login/admin?callbackUrl=/admin/ae-bookmarklet")
  }

  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"
  const bookmarkletHref = buildUniversalAeImportBookmarklet(appOrigin)

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div>
          <Link href="/admin/auto-fulfill" className="text-sm text-violet-700 underline dark:text-violet-300">
            ← Auto-Fulfill
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Favori Affisell Import AE
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Un seul favori pour tous les produits — à installer une fois dans votre navigateur.
          </p>
        </div>
        <AeBookmarkletInstallPanel bookmarkletHref={bookmarkletHref} appOrigin={appOrigin} />
      </div>
    </main>
  )
}
