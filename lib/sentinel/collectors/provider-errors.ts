import { readProviderMetadata } from "@/lib/admin/providers/metadata"
import type { SentinelSignalInput } from "@/lib/sentinel/types"
import { prisma } from "@/lib/prisma"

export async function collectProviderErrorSignals(): Promise<SentinelSignalInput[]> {
  const providers = await prisma.fulfillmentProvider.findMany({
    select: { id: true, name: true, slug: true, metadata: true, status: true },
    take: 50,
  })

  const out: SentinelSignalInput[] = []
  for (const p of providers) {
    const meta = readProviderMetadata(p.metadata)
    if (meta.healthStatus !== "ERROR") continue
    out.push({
      severity: "P1",
      domain: "providers",
      code: "providers.health_error",
      title: `Provider health ERROR — ${p.name}`,
      detail: meta.healthMessage?.trim() || `Fulfillment provider ${p.slug} reported ERROR.`,
      entityType: "provider",
      entityId: p.id,
      playbook: "open-providers",
    })
  }
  return out
}
