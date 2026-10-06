import { prisma } from "@/lib/prisma"
import { isStoreSubdomainEnabled, storeHostSuffix, storeSubdomainHost } from "@/lib/store-host-suffix"
import {
  describeUnreachable,
  probeHostTls,
  shouldProbeStoreSubdomains,
  subdomainProbeHost,
  type SubdomainReachability,
} from "@/lib/store-subdomain-reachability"
import {
  addDomainToVercelProject,
  getVercelProjectDomain,
  isVercelDomainAutoProvisionEnabled,
  type VercelDomainProvisionResult,
} from "@/lib/vercel-project-domains"

/**
 * "unreachable" = Vercel says the host is configured, but a real TLS handshake to it fails (e.g. a proxy in front has no
 * certificate for it). Anything other than "active" makes the public URL fall back to /shops/{slug}, which always works.
 */
export const SUBDOMAIN_UNREACHABLE_STATUS = "unreachable"

const RETRY_SUBDOMAIN_STATUSES = new Set(["pending", "failed", "registered", SUBDOMAIN_UNREACHABLE_STATUS, null])

/** A subdomain found unreachable is not re-provisioned on every dashboard load — the cron re-checks it on its own cadence. */
const UNREACHABLE_RECHECK_MS = 5 * 60 * 1000

/** How long an "active" store may go without being re-verified before the sync looks at it again. */
const ACTIVE_REVERIFY_MS = 24 * 60 * 60 * 1000

export function storeSubdomainWildcardHost(): string {
  return `*.${storeHostSuffix()}`
}

/**
 * Turns "Vercel says active" into "a visitor can really open it". Only an "active" claim is probed; an inconclusive probe
 * (timeout, reset) keeps `previous` rather than flipping a store on a network hiccup.
 */
export async function gateSubdomainStatusWithReachability(
  host: string,
  vercelStatus: string,
  previous: string | null = null
): Promise<{ status: string; error: string | null }> {
  if (vercelStatus !== "active" || !shouldProbeStoreSubdomains()) return { status: vercelStatus, error: null }
  const probe = await probeHostTls(host)
  if (probe.state === "reachable") return { status: "active", error: null }
  if (probe.state === "unreachable") return { status: SUBDOMAIN_UNREACHABLE_STATUS, error: describeUnreachable(probe) }
  return { status: previous ?? "pending", error: null }
}

export async function applyStoreSubdomainVercelResult(
  storeId: string,
  result: VercelDomainProvisionResult,
  host?: string
): Promise<{ status: string; error: string | null }> {
  const gated = host
    ? await gateSubdomainStatusWithReachability(host, result.status)
    : { status: result.status, error: null as string | null }
  await prisma.store.update({
    where: { id: storeId },
    data: {
      subdomainVercelStatus: gated.status,
      subdomainVercelError:
        gated.status === "failed" ? (result.message ?? "Vercel error") : gated.error,
      subdomainVercelSyncedAt: new Date(),
    },
  })
  return gated
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

export type SubdomainReconcileResult = {
  probe: SubdomainReachability | "skipped"
  promoted: number
  demoted: number
}

/**
 * Applies ONE real reachability verdict — a TLS handshake to a sentinel host under the wildcard — to every store's subdomain.
 * The wildcard is a single certificate for all of them, so one probe speaks for all; this replaces "Vercel verified the
 * wildcard, therefore every store is active".
 *   reachable    → stores waiting on it (or previously found unreachable) become active — self-healing once infra is fixed;
 *   unreachable  → stores that claimed active/pending become "unreachable", with the diagnosis stored;
 *   inconclusive → nothing changes.
 * Not probing (dev, previews, AFFISELL_SUBDOMAIN_PROBE=0) keeps the previous behaviour exactly.
 */
export async function reconcileStoreSubdomainsWithReachability(): Promise<SubdomainReconcileResult> {
  if (!shouldProbeStoreSubdomains()) {
    return { probe: "skipped", promoted: await markAllStoreSubdomainsActiveFromWildcard(), demoted: 0 }
  }

  const probe = await probeHostTls(subdomainProbeHost())
  const syncedAt = new Date()

  if (probe.state === "reachable") {
    const { count } = await prisma.store.updateMany({
      where: {
        OR: [
          { subdomainVercelStatus: null },
          { subdomainVercelStatus: { in: ["pending", "registered", SUBDOMAIN_UNREACHABLE_STATUS] } },
        ],
      },
      data: { subdomainVercelStatus: "active", subdomainVercelError: null, subdomainVercelSyncedAt: syncedAt },
    })
    if (count > 0) console.log("[store-subdomain-reachability]", { probe: "reachable", promoted: count })
    return { probe, promoted: count, demoted: 0 }
  }

  if (probe.state === "unreachable") {
    const error = describeUnreachable(probe)
    const { count } = await prisma.store.updateMany({
      where: {
        OR: [
          { subdomainVercelStatus: null },
          { subdomainVercelStatus: { in: ["active", "pending", "registered"] } },
        ],
      },
      data: { subdomainVercelStatus: SUBDOMAIN_UNREACHABLE_STATUS, subdomainVercelError: error, subdomainVercelSyncedAt: syncedAt },
    })
    console.log("[store-subdomain-reachability]", { probe: probe.reason, code: probe.code, demoted: count, error })
    return { probe, promoted: 0, demoted: count }
  }

  console.log("[store-subdomain-reachability]", { probe: "inconclusive", code: probe.code, note: "statuses unchanged" })
  return { probe, promoted: 0, demoted: 0 }
}

/** Register `*.shops.affisell.com` on the Affisell Vercel project (idempotent). */
export async function provisionStoreSubdomainWildcardOnVercel(): Promise<
  VercelDomainProvisionResult & { reconcile?: SubdomainReconcileResult }
> {
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
    const reconcile = await reconcileStoreSubdomainsWithReachability()
    return { ...result, reconcile }
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
  const stored = await applyStoreSubdomainVercelResult(storeId, result, host)
  console.log("[store-subdomain-provision]", { storeId, slug, host, status: result.status, stored: stored.status })
  // Report what a visitor would get, not what Vercel claims.
  return stored.status === SUBDOMAIN_UNREACHABLE_STATUS
    ? { ...result, status: "pending", message: stored.error ?? "Subdomain not reachable over HTTPS yet." }
    : result
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
    await reconcileStoreSubdomainsWithReachability()
    // The verdict was written for every store; report what THIS store ended up with (not a hard-coded "active").
    const current = await prisma.store.findUnique({
      where: { id: storeId },
      select: { subdomainVercelStatus: true, subdomainVercelError: true, subdomainVercelSyncedAt: true },
    })
    return {
      subdomainVercelStatus: current?.subdomainVercelStatus ?? null,
      subdomainVercelError: current?.subdomainVercelError ?? null,
      subdomainVercelSyncedAt: current?.subdomainVercelSyncedAt ?? null,
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

  const previous = await prisma.store.findUnique({
    where: { id: storeId },
    select: { subdomainVercelStatus: true },
  })
  const gated = await gateSubdomainStatusWithReachability(host, remote.status, previous?.subdomainVercelStatus ?? null)
  const syncedAt = new Date()
  await prisma.store.update({
    where: { id: storeId },
    data: { subdomainVercelStatus: gated.status, subdomainVercelError: gated.error, subdomainVercelSyncedAt: syncedAt },
  })

  return { subdomainVercelStatus: gated.status, subdomainVercelError: gated.error, subdomainVercelSyncedAt: syncedAt }
}

/**
 * Idempotent: wildcard SSL first, then per-store hostname if needed.
 * Safe from Brand Studio load, signup, or cron.
 */
export async function ensureStoreSubdomainReady(
  storeId: string,
  slug: string
): Promise<VercelDomainProvisionResult> {
  const known = await prisma.store.findUnique({
    where: { id: storeId },
    select: { subdomainVercelStatus: true, subdomainVercelSyncedAt: true },
  })
  // Found unreachable a moment ago: every dashboard load would repeat the same Vercel calls and the same failing probe.
  // The cron (which calls the wildcard provisioning directly) owns the re-check cadence.
  if (
    known?.subdomainVercelStatus === SUBDOMAIN_UNREACHABLE_STATUS &&
    known.subdomainVercelSyncedAt &&
    Date.now() - known.subdomainVercelSyncedAt.getTime() < UNREACHABLE_RECHECK_MS
  ) {
    return { attempted: false, status: "pending", message: "Subdomain not reachable over HTTPS yet — re-checked recently." }
  }

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

  const synced = await syncStoreSubdomainVercelStatus(storeId, slug)
  const unreachable = synced.subdomainVercelStatus === SUBDOMAIN_UNREACHABLE_STATUS
  return {
    attempted: true,
    status: unreachable ? "pending" : (remote?.status ?? "pending"),
    message: unreachable
      ? (synced.subdomainVercelError ?? "Subdomain not reachable over HTTPS yet.")
      : "Subdomain already on Vercel — SSL pending propagation.",
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
  /** Real-reachability verdict applied to every store when the wildcard certificate is in use. */
  reachability?: { probe: string; code?: string; promoted: number; demoted: number }
}

type VercelDomainProvisionStatus = VercelDomainProvisionResult["status"]

/** Cron: register wildcard + pending store subdomains on Vercel. */
export async function syncPendingStoreSubdomains(limit = 50): Promise<StoreSubdomainSyncBatchResult> {
  const wildcard = await provisionStoreSubdomainWildcardOnVercel()
  if (wildcard.status === "active") {
    const verdict = wildcard.reconcile
    const batch: StoreSubdomainSyncBatchResult = {
      wildcardStatus: wildcard.status,
      scanned: 0,
      sslActive: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
      reachability: verdict
        ? {
            probe: verdict.probe === "skipped" ? "skipped" : verdict.probe.state,
            code: verdict.probe === "skipped" || verdict.probe.state === "reachable" ? undefined : verdict.probe.code,
            promoted: verdict.promoted,
            demoted: verdict.demoted,
          }
        : undefined,
    }
    console.log("[store-subdomain-sync]", batch)
    return batch
  }

  const reverifyBefore = new Date(Date.now() - ACTIVE_REVERIFY_MS)
  const stores = await prisma.store.findMany({
    where: {
      OR: [
        { subdomainVercelStatus: null },
        { subdomainVercelStatus: { in: ["pending", "failed", "registered", SUBDOMAIN_UNREACHABLE_STATUS] } },
        // "active" is a claim that goes stale (a certificate lapses, a proxy changes): look again at least daily.
        { subdomainVercelStatus: "active", subdomainVercelSyncedAt: null },
        { subdomainVercelStatus: "active", subdomainVercelSyncedAt: { lt: reverifyBefore } },
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
