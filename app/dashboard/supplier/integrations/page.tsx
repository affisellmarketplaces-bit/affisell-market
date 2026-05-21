import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"

import { auth } from "@/auth"
import { SupplierIntegrationsPanel } from "@/components/supplier/supplier-integrations-panel"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { maskIntegrationConfig } from "@/lib/supplier-integration-config"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SupplierIntegrationsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/supplier/integrations")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/dashboard")
  }

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (host ? `${proto}://${host}` : "")

  const rows = await prisma.supplierIntegration.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      platform: true,
      name: true,
      enabled: true,
      config: true,
      lastSyncAt: true,
      lastSyncError: true,
      lastSyncSummary: true,
    },
  })

  const initialIntegrations = rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    name: r.name,
    enabled: r.enabled,
    config: maskIntegrationConfig(r.config),
    lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
    lastSyncError: r.lastSyncError,
    lastSyncSummary: r.lastSyncSummary,
    inboundUrl:
      r.platform === "webhook" && base
        ? `${base}/api/integrations/inbound/${r.id}`
        : null,
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/dashboard/supplier"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 mb-6 inline-flex gap-2 text-zinc-600 dark:text-zinc-300"
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to supplier dashboard
      </Link>

      <Card className="mb-8 border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-zinc-900 dark:text-zinc-100" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Platform sync</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Connect Shopify or an automation workflow to import product drafts, then review and
              publish.
            </p>
          </div>
        </div>
      </Card>

      <SupplierIntegrationsPanel initialIntegrations={initialIntegrations} />
    </div>
  )
}
