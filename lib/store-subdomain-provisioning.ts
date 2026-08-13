import { prisma } from "@/lib/prisma"
import { isStoreSubdomainEnabled, storeHostSuffix, storeSubdomainHost } from "@/lib/store-host-suffix"
import {
  addDomainToVercelProject,
  getVercelProjectDomain,
  isVercelDomainAutoProvisionEnabled,
  type VercelDomainProvisionResult,
} from "@/lib/vercel-project-domains"

const RETRY_SUBDOMAIN_STATUSES = new Set(["pending", "failed", "registered", null])

export function storeSubdomainWildcardHost(): string {
  return `*.${storeHostSuffix()}`
}

export async function applyStoreSubdomainVercelResult(
  storeId: string,
  result: VercelDomainProvisionResult
): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: {
      subdomainVercelStatus: result.status,
      subdomainVercelError: result.status === "failed" ? (result.message ?? "Vercel error") : null,
      subdomainVercelSyncedAt: new Date(),
    },
  })
}

export async function markAllStoreSubdomainsActiveFromWildcard(): Promise<number> {
  const syncedAt = new Date()
  const updated = await prisma.store.updateMany({
    where: {
      OR: [
        { subdomainVercelStatus: null },
        { subdomainVercelStatus: { in: ["pending", "registered"] } },
      ],
    },
    data: {
      subdomainVercelStatus: "active",
      subdomainVercelError: null,
      subdomainVercelSyncedAt: syncedAt,
    },
  })
  return updated.count
}

/** Register `*.shops.affisell.com` on the Affisell Vercel project (idempotent). */
export async function provisionStoreSubdomainWildcardOnVercel(): Promise<VercelDomainProvisionResult> {
  if (!isStoreSubdomainEnabled()) {
    return { attempted: false, status: "skipped", message: "Store subdomains disabled" }
  }
  if (!isVercelDomainAutoProvisionEnabled()) {
    return {
      attempted: false,
      status: "skipped",
      message: "Vercel API not configured (VERCEL_API_TOKEN, VERCEL_PROJECT_ID)",
    }
  }

  const host = storeSubdomainWildcardHost()
  const result = await addDomainToVercelProject(host)
  console.log("[store-subdomain-wildcard]", { host, status: result.status, message: result.message })

  if (result.status === "active") {
    const marked = await markAllStoreSubdomainsActiveFromWildcard()
    if (marked > 0) {
      console.log("[store-subdomain-wildcard]", { markedStores: marked })
    }
  }

  return result
}

/** Register `{slug}.shops.affisell.com` for HTTPS on Vercel (idempotent). */
export async function provisionStoreSubdomainOnVercel(
  storeId: string,
  slug: string
): Promise<VercelDomainProvisionResult> {
  if (!isStoreSubdomainEnabled()) {
    const skipped: VercelDomainProvisionResult = {
      attempted: false,
      status: "skipped",
      message: "Store subdomains disabled",
    }
    await applyStoreSubdomainVercelResult(storeId, skipped)
    return skipped
  }
  if (!isVercelDomainAutoProvisionEnabled()) {
    const skipped: VercelDomainProvisionResult = {
      attempted: false,
      status: "skipped",
      message: "Vercel API not configured",
    }
    await applyStoreSubdomainVercelResult(storeId, skipped)
    return skipped
  }

  const host = storeSubdomainHost(slug)
  const result = await addDomainToVercelProject(host)
  await applyStoreSubdomainVercelResult(storeId, result)
  console.log("[store-subdomain-provision]", { storeId, slug, host, status: result.status })
  return result
}

export async function syncStoreSubdomainVercelStatus(
  storeId: string,
  slug: string
): Promise<{
  subdomainVercelStatus: string | null
  subdomainVercelError: string | null
  subdomainVercelSyncedAt: Date | null
}> {
  const wildcard = await getVercelProjectDomain(storeSubdomainWildcardHost())
  if (wildcard?.verified) {
    await markAllStoreSubdomainsActiveFromWildcard()
    return {
      subdomainVercelStatus: "active",
      subdomainVercelError: null,
      subdomainVercelSyncedAt: new Date(),
    }
  }

  const host = storeSubdomainHost(slug)
  const remote = await getVercelProjectDomain(host)
  if (!remote) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { subdomainVercelStatus: true, subdomainVercelError: true, subdomainVercelSyncedAt: true },
    })
    return {
      subdomainVercelStatus: store?.subdomainVercelStatus ?? null,
      subdomainVercelError: store?.subdomainVercelError ?? null,
      subdomainVercelSyncedAt: store?.subdomainVercelSyncedAt ?? null,
    }
  }

  await prisma.store.update({
    where: { id: storeId },
    data: {
      subdomainVercelStatus: remote.status,
      subdomainVercelError: null,
      subdomainVercelSyncedAt: new Date(),
    },
  })

  return {
    subdomainVercelStatus: remote.status,
    subdomainVercelError: null,
    subdomainVercelSyncedAt: new Date(),
  }
}

/**
 * Idempotent: wildcard SSL first, then per-store hostname if needed.
 * Safe from Brand Studio load, signup, or cron.
 */
export async function ensureStoreSubdomainReady(
  storeId: string,
  slug: string
): Promise<VercelDomainProvisionResult> {
  const wildcard = await provisionStoreSubdomainWildcardOnVercel()
  if (wildcard.status === "active") {
    return wildcard
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { subdomainVercelStatus: true },
  })

  const remote = await getVercelProjectDomain(storeSubdomainHost(slug))
  const shouldProvision =
    !remote || RETRY_SUBDOMAIN_STATUSES.has(store?.subdomainVercelStatus ?? null)

  if (shouldProvision) {
    return provisionStoreSubdomainOnVercel(storeId, slug)
  }

  await syncStoreSubdomainVercelStatus(storeId, slug)
  return {
    attempted: true,
    status: remote?.status ?? "pending",
    message: "Subdomain already on Vercel — SSL pending propagation.",
    vercelVerified: remote?.verified,
  }
}

export type StoreSubdomainSyncBatchResult = {
  wildcardStatus: VercelDomainProvisionStatus | "not_attempted"
  scanned: number
  sslActive: number
  pending: number
  failed: number
  skipped: number
}

type VercelDomainProvisionStatus = VercelDomainProvisionResult["status"]

/** Cron: register wildcard + pending store subdomains on Vercel. */
export async function syncPendingStoreSubdomains(limit = 50): Promise<StoreSubdomainSyncBatchResult> {
  const wildcard = await provisionStoreSubdomainWildcardOnVercel()
  if (wildcard.status === "active") {
    const batch: StoreSubdomainSyncBatchResult = {
      wildcardStatus: wildcard.status,
      scanned: 0,
      sslActive: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
    }
    console.log("[store-subdomain-sync]", batch)
    return batch
  }

  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { subdomainVercelStatus: null },
        { subdomainVercelStatus: { in: ["pending", "failed", "registered"] } },
      ],
    },
    select: { id: true, slug: true, subdomainVercelStatus: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  })

  const batch: StoreSubdomainSyncBatchResult = {
    wildcardStatus: wildcard.attempted ? wildcard.status : "not_attempted",
    scanned: stores.length,
    sslActive: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
  }

  for (const { id, slug } of stores) {
    try {
      const result = await ensureStoreSubdomainReady(id, slug)
      switch (result.status) {
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
      console.log("[store-subdomain-sync]", {
        storeId: id,
        slug,
        result: "error",
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  console.log("[store-subdomain-sync]", batch)
  return batch
}
