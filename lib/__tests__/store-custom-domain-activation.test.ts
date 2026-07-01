import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/verify-store-domain", () => ({
  customDomainPointsToAffisell: vi.fn(),
}))

vi.mock("@/lib/vercel-project-domains", () => ({
  isVercelDomainAutoProvisionEnabled: vi.fn(),
  getVercelProjectDomain: vi.fn(),
}))

vi.mock("@/lib/store-domain-provisioning", () => ({
  provisionStoreCustomDomainOnVercel: vi.fn(),
  syncStoreVercelDomainStatus: vi.fn(),
}))

const prismaMock = {
  store: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

describe("store custom domain activation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("STORE_CNAME_TARGET", "cname.affisell.com")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("returns dnsReady false when CNAME not configured", async () => {
    const { customDomainPointsToAffisell } = await import("@/lib/verify-store-domain")
    vi.mocked(customDomainPointsToAffisell).mockResolvedValue(false)
    prismaMock.store.findUnique.mockResolvedValue({
      id: "st_1",
      customDomain: "shop.example.com",
      domainVerified: false,
      vercelDomainStatus: null,
      vercelDomainError: null,
    })

    const { activateStoreCustomDomainIfReady } = await import("@/lib/store-custom-domain-activation")
    const result = await activateStoreCustomDomainIfReady("st_1")
    expect(result.dnsReady).toBe(false)
    expect(prismaMock.store.update).not.toHaveBeenCalled()
  })

  it("marks verified and provisions Vercel when DNS is ready", async () => {
    const { customDomainPointsToAffisell } = await import("@/lib/verify-store-domain")
    const { isVercelDomainAutoProvisionEnabled, getVercelProjectDomain } = await import(
      "@/lib/vercel-project-domains"
    )
    const { provisionStoreCustomDomainOnVercel } = await import("@/lib/store-domain-provisioning")

    vi.mocked(customDomainPointsToAffisell).mockResolvedValue(true)
    vi.mocked(isVercelDomainAutoProvisionEnabled).mockReturnValue(true)
    vi.mocked(getVercelProjectDomain).mockResolvedValue(null)
    vi.mocked(provisionStoreCustomDomainOnVercel).mockResolvedValue({
      attempted: true,
      status: "active",
      message: "SSL active",
      vercelVerified: true,
    })

    prismaMock.store.findUnique
      .mockResolvedValueOnce({
        id: "st_1",
        customDomain: "shop.example.com",
        domainVerified: false,
        vercelDomainStatus: null,
        vercelDomainError: null,
      })
      .mockResolvedValueOnce({
        id: "st_1",
        customDomain: "shop.example.com",
        domainVerified: true,
        vercelDomainStatus: "active",
        vercelDomainError: null,
      })

    prismaMock.store.update.mockResolvedValue({})

    const { activateStoreCustomDomainIfReady } = await import("@/lib/store-custom-domain-activation")
    const result = await activateStoreCustomDomainIfReady("st_1")

    expect(result.dnsReady).toBe(true)
    expect(result.domainVerified).toBe(true)
    expect(result.vercelStatus).toBe("active")
    expect(provisionStoreCustomDomainOnVercel).toHaveBeenCalledWith("st_1", "shop.example.com")
  })
})
