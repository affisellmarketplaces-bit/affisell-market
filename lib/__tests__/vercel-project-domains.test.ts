import { afterEach, describe, expect, it, vi } from "vitest"

describe("normalizeVercelProjectDomain (via addDomainToVercelProject guard)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("accepts wildcard store suffix hostnames", async () => {
    vi.stubEnv("VERCEL_API_TOKEN", "")
    vi.stubEnv("VERCEL_PROJECT_ID", "")
    const { addDomainToVercelProject } = await import("@/lib/vercel-project-domains")
    const result = await addDomainToVercelProject("*.shops.affisell.com")
    expect(result.status).toBe("skipped")
    expect(result.message).toContain("not configured")
  })
})
