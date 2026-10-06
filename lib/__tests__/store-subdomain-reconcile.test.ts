import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  updateMany: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  addDomain: vi.fn(),
  getDomain: vi.fn(),
  autoProvision: vi.fn(),
  probe: vi.fn(),
  shouldProbe: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { store: { updateMany: m.updateMany, update: m.update, findUnique: m.findUnique, findMany: m.findMany } },
}))
vi.mock("@/lib/vercel-project-domains", () => ({
  addDomainToVercelProject: m.addDomain,
  getVercelProjectDomain: m.getDomain,
  isVercelDomainAutoProvisionEnabled: m.autoProvision,
}))
vi.mock("@/lib/store-subdomain-reachability", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/store-subdomain-reachability")>()),
  probeHostTls: m.probe,
  shouldProbeStoreSubdomains: m.shouldProbe,
}))

import {
  ensureStoreSubdomainReady,
  gateSubdomainStatusWithReachability,
  reconcileStoreSubdomainsWithReachability,
  syncPendingStoreSubdomains,
  syncStoreSubdomainVercelStatus,
} from "@/lib/store-subdomain-provisioning"

const HANDSHAKE_FAILED = { state: "unreachable", reason: "tls_handshake_failed", code: "ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
  m.shouldProbe.mockReturnValue(true)
  m.autoProvision.mockReturnValue(true)
  m.updateMany.mockResolvedValue({ count: 3 })
})

describe("reconcileStoreSubdomainsWithReachability", () => {
  it("probes the wildcard sentinel host once, not every store", async () => {
    m.probe.mockResolvedValue({ state: "reachable" })
    await reconcileStoreSubdomainsWithReachability()
    expect(m.probe).toHaveBeenCalledTimes(1)
    expect(m.probe).toHaveBeenCalledWith("tls-check.shops.affisell.com")
  })

  it("reachable → stores waiting on it, or previously unreachable, become active (self-healing)", async () => {
    m.probe.mockResolvedValue({ state: "reachable" })
    const r = await reconcileStoreSubdomainsWithReachability()
    expect(r).toMatchObject({ promoted: 3, demoted: 0 })
    const arg = m.updateMany.mock.calls[0]![0]
    expect(arg.data).toMatchObject({ subdomainVercelStatus: "active", subdomainVercelError: null })
    expect(JSON.stringify(arg.where)).toContain("unreachable")
    expect(JSON.stringify(arg.where)).toContain("pending")
  })

  it("unreachable → stores that CLAIM active are demoted, with the diagnosis stored — the production bug", async () => {
    m.probe.mockResolvedValue(HANDSHAKE_FAILED)
    const r = await reconcileStoreSubdomainsWithReachability()
    expect(r).toMatchObject({ promoted: 0, demoted: 3 })
    const arg = m.updateMany.mock.calls[0]![0]
    expect(arg.data.subdomainVercelStatus).toBe("unreachable")
    expect(arg.data.subdomainVercelError).toMatch(/TLS handshake refused/)
    expect(JSON.stringify(arg.where)).toContain('"active"')
  })

  it("inconclusive → nothing changes (a network blip must not flip stores)", async () => {
    m.probe.mockResolvedValue({ state: "inconclusive", code: "ETIMEDOUT" })
    const r = await reconcileStoreSubdomainsWithReachability()
    expect(r).toMatchObject({ promoted: 0, demoted: 0 })
    expect(m.updateMany).not.toHaveBeenCalled()
  })

  it("without probing (dev / previews / opt-out) behaves exactly as before: wildcard verified → active", async () => {
    m.shouldProbe.mockReturnValue(false)
    const r = await reconcileStoreSubdomainsWithReachability()
    expect(r.probe).toBe("skipped")
    expect(m.probe).not.toHaveBeenCalled()
    expect(m.updateMany.mock.calls[0]![0].data.subdomainVercelStatus).toBe("active")
  })
})

describe("gateSubdomainStatusWithReachability", () => {
  it("only an 'active' claim is probed; other statuses pass through untouched", async () => {
    expect(await gateSubdomainStatusWithReachability("a.shops.affisell.com", "pending")).toEqual({ status: "pending", error: null })
    expect(m.probe).not.toHaveBeenCalled()
  })

  it("active + handshake refused → unreachable with the reason", async () => {
    m.probe.mockResolvedValue(HANDSHAKE_FAILED)
    const g = await gateSubdomainStatusWithReachability("a.shops.affisell.com", "active")
    expect(g.status).toBe("unreachable")
    expect(g.error).toMatch(/Cloudflare/)
  })

  it("active + inconclusive keeps the previous state", async () => {
    m.probe.mockResolvedValue({ state: "inconclusive", code: "ECONNRESET" })
    expect((await gateSubdomainStatusWithReachability("a.shops.affisell.com", "active", "active")).status).toBe("active")
    expect((await gateSubdomainStatusWithReachability("a.shops.affisell.com", "active", null)).status).toBe("pending")
  })

  it("active + reachable stays active", async () => {
    m.probe.mockResolvedValue({ state: "reachable" })
    expect(await gateSubdomainStatusWithReachability("a.shops.affisell.com", "active")).toEqual({ status: "active", error: null })
  })
})

describe("syncStoreSubdomainVercelStatus", () => {
  it("wildcard verified on Vercel but unreachable → reports what the store really has, not a hard-coded 'active'", async () => {
    m.getDomain.mockResolvedValue({ verified: true, status: "active" })
    m.probe.mockResolvedValue(HANDSHAKE_FAILED)
    m.findUnique.mockResolvedValue({
      subdomainVercelStatus: "unreachable",
      subdomainVercelError: "TLS handshake refused",
      subdomainVercelSyncedAt: new Date(),
    })
    const r = await syncStoreSubdomainVercelStatus("s1", "ecom-store")
    expect(r.subdomainVercelStatus).toBe("unreachable")
    expect(m.updateMany.mock.calls[0]![0].data.subdomainVercelStatus).toBe("unreachable")
  })

  it("per-host path: Vercel says active, handshake fails → stored as unreachable", async () => {
    m.getDomain.mockImplementation(async (host: string) => (host.startsWith("*.") ? null : { verified: true, status: "active" }))
    m.probe.mockResolvedValue(HANDSHAKE_FAILED)
    m.findUnique.mockResolvedValue({ subdomainVercelStatus: "active" })
    const r = await syncStoreSubdomainVercelStatus("s1", "ecom-store")
    expect(r.subdomainVercelStatus).toBe("unreachable")
    expect(m.update.mock.calls[0]![0].data).toMatchObject({ subdomainVercelStatus: "unreachable" })
    expect(m.probe).toHaveBeenCalledWith("ecom-store.shops.affisell.com")
  })
})

describe("ensureStoreSubdomainReady", () => {
  it("does not hammer Vercel on every dashboard load while a store is known unreachable", async () => {
    m.findUnique.mockResolvedValue({ subdomainVercelStatus: "unreachable", subdomainVercelSyncedAt: new Date(Date.now() - 60_000) })
    const r = await ensureStoreSubdomainReady("s1", "ecom-store")
    expect(r).toMatchObject({ attempted: false, status: "pending" })
    expect(m.addDomain).not.toHaveBeenCalled()
    expect(m.probe).not.toHaveBeenCalled()
  })

  it("re-checks once the quiet period has passed", async () => {
    m.findUnique.mockResolvedValue({ subdomainVercelStatus: "unreachable", subdomainVercelSyncedAt: new Date(Date.now() - 20 * 60_000) })
    m.addDomain.mockResolvedValue({ attempted: true, status: "active" })
    m.probe.mockResolvedValue({ state: "reachable" })
    await ensureStoreSubdomainReady("s1", "ecom-store")
    expect(m.addDomain).toHaveBeenCalled()
    expect(m.probe).toHaveBeenCalled()
  })
})

describe("syncPendingStoreSubdomains (cron)", () => {
  it("reports the real-reachability verdict, so a broken wildcard shows up in the cron log", async () => {
    m.addDomain.mockResolvedValue({ attempted: true, status: "active" })
    m.probe.mockResolvedValue(HANDSHAKE_FAILED)
    const batch = await syncPendingStoreSubdomains()
    expect(batch.wildcardStatus).toBe("active")
    expect(batch.reachability).toMatchObject({ probe: "unreachable", code: "ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE", demoted: 3 })
  })
})
