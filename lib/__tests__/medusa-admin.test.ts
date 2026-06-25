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

describe("medusaAdminFetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("sends Authorization Bearer header", async () => {
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
    expect(headers.Authorization).toBe("Bearer sk_test_header")
    expect(headers["Content-Type"]).toBe("application/json")
  })
})
