import { afterEach, describe, expect, it, vi } from "vitest"

describe("resolveMedusaAdminToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns trimmed token", async () => {
    vi.stubEnv("MEDUSA_ADMIN_TOKEN", "  sk_test_abc  ")
    const { resolveMedusaAdminToken } = await import("@/lib/medusa-admin.impl")
    expect(resolveMedusaAdminToken()).toBe("sk_test_abc")
  })

  it("strips surrounding quotes", async () => {
    vi.stubEnv("MEDUSA_ADMIN_TOKEN", '"sk_test_quoted"')
    const { resolveMedusaAdminToken } = await import("@/lib/medusa-admin.impl")
    expect(resolveMedusaAdminToken()).toBe("sk_test_quoted")
  })

  it("throws when missing", async () => {
    vi.stubEnv("MEDUSA_ADMIN_TOKEN", "")
    const { resolveMedusaAdminToken } = await import("@/lib/medusa-admin.impl")
    expect(() => resolveMedusaAdminToken()).toThrow("MEDUSA_ADMIN_TOKEN missing")
  })
})

describe("affisellCentsToMedusaMajorUnits", () => {
  it("converts Affisell cents to Medusa major currency units", async () => {
    const { affisellCentsToMedusaMajorUnits } = await import("@/lib/medusa-admin.impl")
    expect(affisellCentsToMedusaMajorUnits(5)).toBe(0.05)
    expect(affisellCentsToMedusaMajorUnits(50)).toBe(0.5)
    expect(affisellCentsToMedusaMajorUnits(139_500)).toBe(1395)
  })
})

describe("medusaAdminFetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("sends Authorization Basic header (Medusa v2 secret API key)", async () => {
    vi.stubEnv("MEDUSA_ADMIN_TOKEN", "sk_test_header")
    vi.stubEnv("MEDUSA_BACKEND_URL", "http://localhost:9000")

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ regions: [] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const { medusaAdminFetch } = await import("@/lib/medusa-admin.impl")
    await medusaAdminFetch("/admin/regions?limit=1")

    expect(fetchMock).toHaveBeenCalledOnce()
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Basic sk_test_header")
    expect(headers["Content-Type"]).toBe("application/json")
  })
})
