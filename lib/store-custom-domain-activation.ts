import { prisma } from "@/lib/prisma"
import { getStoreCnameTarget } from "@/lib/store-cname-target"
import {
  provisionStoreCustomDomainOnVercel,
  syncStoreVercelDomainStatus,
} from "@/lib/store-domain-provisioning"
import {
  getVercelProjectDomain,
  isVercelDomainAutoProvisionEnabled,
} from "@/lib/vercel-project-domains"
import { customDomainPointsToAffisell } from "@/lib/verify-store-domain"

export type StoreDomainActivationResult = {
  storeId: string
  domain: string
  dnsReady: boolean
  domainVerified: boolean
  vercelStatus: string | null
  vercelError: string | null
  message?: string
}

const RETRY_VERCEL_STATUSES = new Set(["pending", "failed", "registered", null])

async function loadStore(storeId: string) {
  return prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      customDomain: true,
      domainVerified: true,
      vercelDomainStatus: true,
      vercelDomainError: true,
    },
  })
}

/**
 * Idempotent: verify DNS → mark domainVerified → register/sync Vercel SSL.
 * Safe to call from Verify button, store save, or cron.
 */
export async function activateStoreCustomDomainIfReady(
  storeId: string
): Promise<StoreDomainActivationResult> {
  const store = await loadStore(storeId)
  const domain = store?.customDomain?.trim() ?? ""
  if (!store || !domain) {
    return {
      storeId,
      domain: domain || "",
      dnsReady: false,
      domainVerified: false,
      vercelStatus: null,
      vercelError: null,
      message: "No custom domain configured",
    }
  }

  const target = getStoreCnameTarget()
  const dnsReady = await customDomainPointsToAffisell(domain, target)
  if (!dnsReady) {
    return {
      storeId,
      domain,
      dnsReady: false,
      domainVerified: store.domainVerified,
      vercelStatus: store.vercelDomainStatus,
      vercelError: store.vercelDomainError,
      message: `CNAME for ${domain} must point to ${target}`,
    }
  }

  if (!store.domainVerified) {
    await prisma.store.update({
      where: { id: storeId },
      data: { domainVerified: true },
    })
  }

  if (!isVercelDomainAutoProvisionEnabled()) {
    await prisma.store.update({
      where: { id: storeId },
      data: {
        vercelDomainStatus: "skipped",
        vercelDomainError: null,
        vercelDomainSyncedAt: new Date(),
      },
    })
    const refreshed = await loadStore(storeId)
    return {
      storeId,
      domain,
      dnsReady: true,
      domainVerified: true,
      vercelStatus: refreshed?.vercelDomainStatus ?? "skipped",
      vercelError: null,
      message: "DNS verified — add hostname in Vercel Domains for HTTPS (platform token not set).",
    }
  }

  const remote = await getVercelProjectDomain(domain)
  const shouldProvision =
    !remote || RETRY_VERCEL_STATUSES.has(store.vercelDomainStatus)

  if (shouldProvision) {
    const result = await provisionStoreCustomDomainOnVercel(storeId, domain)
    return {
      storeId,
      domain,
      dnsReady: true,
      domainVerified: true,
      vercelStatus: result.status,
      vercelError: result.status === "failed" ? (result.message ?? "Vercel error") : null,
      message: result.message,
    }
  }

  await syncStoreVercelDomainStatus(storeId)
  const refreshed = await loadStore(storeId)
  return {
    storeId,
    domain,
    dnsReady: true,
    domainVerified: true,
    vercelStatus: refreshed?.vercelDomainStatus ?? remote.status,
    vercelError: refreshed?.vercelDomainError ?? null,
    message:
      refreshed?.vercelDomainStatus === "active"
        ? "SSL active on Vercel."
        : "Domain on Vercel — SSL pending DNS propagation.",
  }
}

export type StoreDomainSyncBatchResult = {
  scanned: number
  dnsReady: number
  sslActive: number
  pending: number
  failed: number
  skipped: number
}

/** Cron: auto-complete DNS verify + Vercel SSL for merchants who configured CNAME. */
export async function syncPendingStoreCustomDomains(
  limit = 40
): Promise<StoreDomainSyncBatchResult> {
  const stores = await prisma.store.findMany({
    where: {
      customDomain: { not: null },
      OR: [
        { domainVerified: false },
        { vercelDomainStatus: { in: ["pending", "failed", "registered"] } },
        { vercelDomainStatus: null },
        { AND: [{ domainVerified: true }, { NOT: { vercelDomainStatus: "active" } }] },
      ],
    },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  })

  const batch: StoreDomainSyncBatchResult = {
    scanned: stores.length,
    dnsReady: 0,
    sslActive: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
  }

  for (const { id } of stores) {
    try {
      const result = await activateStoreCustomDomainIfReady(id)
      if (!result.dnsReady) continue
      batch.dnsReady++
      switch (result.vercelStatus) {
        case "active":
          batch.sslActive++
          break
        case "failed":
          batch.failed++
          break
        case "skipped":
          batch.skipped++
          break
        default:
          batch.pending++
      }
    } catch (e) {
      batch.failed++
      console.log("[store-domain-sync]", {
        storeId: id,
        result: "error",
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  console.log("[store-domain-sync]", batch)
  return batch
}

/** Reset Vercel tracking when merchant changes hostname. */
export async function clearStoreDomainHostingState(storeId: string): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: {
      domainVerified: false,
      vercelDomainStatus: null,
      vercelDomainError: null,
      vercelDomainSyncedAt: null,
    },
  })
}
