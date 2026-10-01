import { redirect } from "next/navigation"

import { PlatformFlagsClient } from "@/app/admin/settings/platform-flags/platform-flags-client"
import { listPlatformFlags, PLATFORM_FLAG_LABELS } from "@/lib/admin/platform-flags.server"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminPlatformFlagsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/settings/platform-flags")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const flags = await listPlatformFlags()

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Admin</p>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Interrupteurs plateforme
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Effet immédiat, pas de redéploiement. Chaque interrupteur reste actif tant qu&apos;il
          n&apos;est pas repassé manuellement — pensez à le réactiver après un test ou une urgence
          ponctuelle.
        </p>
      </div>

      <PlatformFlagsClient
        initialFlags={flags.map((f) => ({
          ...f,
          updatedAt: f.updatedAt ? f.updatedAt.toISOString() : null,
          title: PLATFORM_FLAG_LABELS[f.key].title,
          description: PLATFORM_FLAG_LABELS[f.key].description,
        }))}
      />
    </main>
  )
}
