import { afterEach, describe, expect, it, vi } from "vitest"

// Finalisation master doc, C3: a cron endpoint is authorised by a secret the caller PROVES, never by a header the caller
// can simply add (`x-vercel-cron`) nor by a secret placed in the URL (`?secret=`, which leaks into logs / Referer).

vi.mock("@/lib/ing/escalation", () => ({ checkEscalation: vi.fn(async () => ({})) }))
vi.mock("@/lib/ing/manual-supplier-nudge", () => ({ loadManualSupplierNudgeCandidates: vi.fn(async () => ({ candidates: [] })) }))
vi.mock("@/lib/cron/ing-manual-nudge", () => ({ runIngManualNudgeCron: vi.fn(async () => ({})) }))
vi.mock("@/lib/legal/run-legal-scan", () => ({ runLegalGuardianScan: vi.fn(async () => ({ results: [] })) }))
vi.mock("@/lib/slack/send-ing-alert", () => ({ sendIngSlackAlert: vi.fn(async () => {}) }))
vi.mock("@/lib/slack/send-legal-alert", () => ({ sendLegalSlackAlert: vi.fn(async () => {}) }))
vi.mock("@/lib/prisma", () => ({ prisma: {}, fulfillmentPrisma: {} }))

import { authorizeAliExpressOps } from "@/lib/aliexpress-ops-auth"
import { GET as legalGuardianGET } from "@/app/api/cron/legal-guardian/route"
import { GET as ingNudgeGET } from "@/app/api/cron/ing-manual-nudge/route"
import { NextRequest } from "next/server"

const SECRET = "test-secret-value-32chars-xxxxxx"

function req(url: string, headers: Record<string, string> = {}, method = "GET") {
  return new NextRequest(url, { method, headers })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe.each([
  ["legal-guardian", "https://example.com/api/cron/legal-guardian?dry=1", legalGuardianGET],
  ["ing-manual-nudge", "https://example.com/api/cron/ing-manual-nudge?dry=1", ingNudgeGET],
] as const)("cron %s — authorisation", (_name, url, GET) => {
  function prod() {
    vi.stubEnv("CRON_SECRET", SECRET)
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NODE_ENV", "production")
  }

  it("refuses a request that only carries the x-vercel-cron header", async () => {
    prod()
    const res = await GET(req(url, { "x-vercel-cron": "1" }))
    expect(res.status).toBe(401)
  })

  it("refuses an anonymous request in production", async () => {
    prod()
    expect((await GET(req(url))).status).toBe(401)
  })

  it("refuses a wrong Bearer even when x-vercel-cron is present", async () => {
    prod()
    const res = await GET(req(url, { authorization: "Bearer not-the-secret", "x-vercel-cron": "1" }))
    expect(res.status).toBe(401)
  })

  it("accepts the Bearer CRON_SECRET (what Vercel Cron and the GitHub workflow send)", async () => {
    prod()
    const res = await GET(req(url, { authorization: `Bearer ${SECRET}` }))
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(503)
  })

  it("accepts the x-cron-secret header", async () => {
    prod()
    const res = await GET(req(url, { "x-cron-secret": SECRET }))
    expect(res.status).not.toBe(401)
  })

  it("answers 503 (not open) when CRON_SECRET is missing in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CRON_SECRET", "")
    const res = await GET(req(url, { "x-vercel-cron": "1" }))
    expect(res.status).toBe(503)
  })
})

describe("authorizeAliExpressOps — secret in the URL", () => {
  function prod() {
    vi.stubEnv("CRON_SECRET", SECRET)
    vi.stubEnv("VERCEL_ENV", "production")
  }

  it("no longer accepts ?secret=", () => {
    prod()
    const r = new Request(`https://example.com/api/aliexpress/order/create?secret=${SECRET}`, { method: "POST" })
    const denied = authorizeAliExpressOps(r)
    expect(denied?.status).toBe(401)
  })

  it("does not advertise ?secret= in its hint", async () => {
    prod()
    const denied = authorizeAliExpressOps(new Request("https://example.com/x", { method: "POST" }))
    expect(JSON.stringify(await denied!.json())).not.toContain("?secret=")
  })

  it("still accepts the Bearer, the x-cron-secret header and the body secret", () => {
    prod()
    const url = "https://example.com/api/aliexpress/order/create"
    expect(authorizeAliExpressOps(new Request(url, { method: "POST", headers: { authorization: `Bearer ${SECRET}` } }))).toBeNull()
    expect(authorizeAliExpressOps(new Request(url, { method: "POST", headers: { "x-cron-secret": SECRET } }))).toBeNull()
    expect(authorizeAliExpressOps(new Request(url, { method: "POST" }), { bodySecret: SECRET })).toBeNull()
  })
})
