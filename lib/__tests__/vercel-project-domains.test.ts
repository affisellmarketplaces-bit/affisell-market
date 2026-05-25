import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("vercel-project-domains", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubEnv("VERCEL_API_TOKEN", "test-token")
    vi.stubEnv("VERCEL_PROJECT_ID", "prj_test")
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("skips when not configured", async () => {
    vi.stubEnv("VERCEL_API_TOKEN", "")
    vi.resetModules()
    const { isVercelDomainAutoProvisionEnabled, addDomainToVercelProject } = await import(
      "@/lib/vercel-project-domains"
    )
    expect(isVercelDomainAutoProvisionEnabled()).toBe(false)
    const r = await addDomainToVercelProject("shop.example.com")
    expect(r.status).toBe("skipped")
  })

  it("registers domain on success", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ name: "shop.example.com", verified: true }),
    })) as unknown as typeof fetch

    vi.resetModules()
    const { addDomainToVercelProject } = await import("@/lib/vercel-project-domains")
    const r = await addDomainToVercelProject("shop.example.com")
    expect(r.status).toBe("active")
    expect(r.vercelVerified).toBe(true)
  })
})
