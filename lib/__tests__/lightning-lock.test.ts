import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Temporary Lightning lock (lib/payouts/lightning-lock.ts): nobody — supplier or admin — can switch Lightning ON
 * through the API while `LIGHTNING_PAYOUTS_MODE` is not `enabled`; switching OFF stays possible. The routes are called
 * directly (no UI), with a session, Prisma and the trust score replaced.
 */
const calls = vi.hoisted(() => ({ upserts: [] as Array<Record<string, unknown>>, trust: 0 }))
const session = vi.hoisted(() => ({ role: "SUPPLIER", id: "sup1" }))

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: session.id, role: session.role } }) }))
vi.mock("@/lib/request-origin-guard", () => ({ assertSameSiteRequestOrigin: () => null }))
vi.mock("@/lib/trust-score", () => ({
  calculateTrustScoreBreakdown: async () => {
    calls.trust += 1
    return { score: 90 }
  },
}))
vi.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: async () => ({ ok: true, session: { user: { id: "admin1" } } }),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplierProfile: {
      upsert: async (args: { update: Record<string, unknown> }) => {
        calls.upserts.push(args.update)
        return { trustScore: 90, lightningEnabled: args.update.lightningEnabled ?? false, lightningAdminOverride: false }
      },
    },
    user: { findFirst: async () => ({ id: "sup1", email: "s@x", store: null }) },
  },
}))

import { PATCH as adminPatch } from "@/app/api/admin/suppliers/[userId]/lightning/route"
import { GET as supplierGet, PATCH as supplierPatch } from "@/app/api/supplier/lightning-payout/route"
import { isLightningLocked, lightningToggleDecision } from "@/lib/payouts/lightning-lock"

const body = (lightningEnabled: unknown) =>
  new Request("https://affisell.com/api/x", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lightningEnabled }),
  })
const params = { params: Promise.resolve({ userId: "sup1" }) }

beforeEach(() => {
  delete process.env.LIGHTNING_PAYOUTS_MODE
  calls.upserts = []
  calls.trust = 0
})

describe("lock rule", () => {
  it("locked by default and for any value but 'enabled'", () => {
    for (const v of [undefined, "", "locked", "on", "true", "1", "yes", "ENABLED", "Enabled", " enabled", "enabled ", "enabled\n", "\"enabled\"", "enabled;"]) {
      expect(isLightningLocked({ LIGHTNING_PAYOUTS_MODE: v })).toBe(true)
    }
    expect(isLightningLocked({})).toBe(true)
    expect(isLightningLocked({ LIGHTNING_PAYOUTS_MODE: "enabled" })).toBe(false)
  })
  it("refuses ON, always allows OFF", () => {
    expect(lightningToggleDecision(true, {}).allowed).toBe(false)
    expect(lightningToggleDecision(false, {}).allowed).toBe(true)
    expect(lightningToggleDecision(true, { LIGHTNING_PAYOUTS_MODE: "enabled" }).allowed).toBe(true)
  })
})

describe("supplier API (direct calls)", () => {
  it("PATCH ON → 409 lightning_locked with a message, nothing written, trust score not even read", async () => {
    const res = await supplierPatch(body(true))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json).toMatchObject({ error: "lightning_locked", lightningLocked: true })
    expect(json.message).toMatch(/temporairement suspendu/)
    expect(calls.upserts).toHaveLength(0)
    expect(calls.trust).toBe(0)
  })
  it("PATCH OFF still works", async () => {
    const res = await supplierPatch(body(false))
    expect(res.status).toBe(200)
    expect(calls.upserts).toEqual([expect.objectContaining({ lightningEnabled: false })])
  })
  it("a non-boolean body is still a 400, never a write", async () => {
    expect((await supplierPatch(body("true"))).status).toBe(400)
    expect(calls.upserts).toHaveLength(0)
  })
  it("GET tells the page it is locked, and never writes the flag", async () => {
    const json = await (await supplierGet()).json()
    expect(json.lightningLocked).toBe(true)
    expect(calls.upserts.every((u) => !("lightningEnabled" in u))).toBe(true)
  })
  it("unlocked: the existing rules apply again (score >= 50 → ON allowed)", async () => {
    process.env.LIGHTNING_PAYOUTS_MODE = "enabled"
    const res = await supplierPatch(body(true))
    expect(res.status).toBe(200)
    expect(calls.upserts).toEqual([expect.objectContaining({ lightningEnabled: true })])
  })
})

describe("admin API (direct calls)", () => {
  it("PATCH ON → 409 lightning_locked, nothing written (admin override included)", async () => {
    const res = await adminPatch(body(true), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: "lightning_locked" })
    expect(calls.upserts).toHaveLength(0)
  })
  it("PATCH OFF still works", async () => {
    const res = await adminPatch(body(false), params)
    expect(res.status).toBe(200)
    expect(calls.upserts).toEqual([{ lightningEnabled: false, lightningAdminOverride: false }])
  })
  it("unlocked: admin can switch it ON again", async () => {
    process.env.LIGHTNING_PAYOUTS_MODE = "enabled"
    expect((await adminPatch(body(true), params)).status).toBe(200)
  })
})

// Everything a deployment reads: Vercel / Next config, env templates, workflows, build scripts and the shipped code.
const DEPLOY_PATHS = [
  "vercel.json", "next.config.ts", "package.json", ".github", "scripts", "instrumentation.ts", "proxy.ts",
  "lib", "app", "components", "workers", "inngest", ":(glob).env*", ":!lib/__tests__",
]

describe("a deployment can not unlock Lightning by accident", { timeout: 60_000 }, () => {
  it("no tracked file sets LIGHTNING_PAYOUTS_MODE (config, env templates, workflows, scripts, code)", async () => {
    const { execFileSync } = await import("node:child_process")
    let out = ""
    try {
      out = execFileSync("git", ["grep", "-nE", "LIGHTNING_PAYOUTS_MODE[[:space:]]*[:=]", "--", ...DEPLOY_PATHS], { encoding: "utf8" })
    } catch {
      out = "" // git grep exits 1 when nothing matches
    }
    expect(out.trim()).toBe("")
  })
  it("the code never assigns the variable at runtime", async () => {
    const { execFileSync } = await import("node:child_process")
    let out = ""
    try {
      out = execFileSync("git", ["grep", "-n", "env.LIGHTNING_PAYOUTS_MODE[[:space:]]*=", "--", ...DEPLOY_PATHS], { encoding: "utf8" })
    } catch {
      out = ""
    }
    expect(out.trim()).toBe("")
  })
})

describe("no other writer can set lightningEnabled to true", () => {
  it("only the two locked routes (and a guarded dev script) write a non-false value", async () => {
    const { execFileSync } = await import("node:child_process")
    const out = execFileSync("git", ["grep", "-nE", "lightningEnabled:[[:space:]]*(true|enabling|parsed)", "--", "lib", "app", "components", "workers", "inngest"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter((l) => l && !l.includes("__tests__") && !/select:|\bselect\b/.test(l))
    const files = [...new Set(out.map((l) => l.split(":")[0]))].sort()
    expect(files).toEqual([
      "app/api/admin/suppliers/[userId]/lightning/route.ts",
      "app/api/supplier/lightning-payout/route.ts",
      "lib/admin/suppliers/load-lightning-suppliers.ts",
    ])
  })
})
