import { beforeEach, describe, expect, it, vi } from "vitest"

const calls = vi.hoisted(() => ({ apply: 0, undo: 0, grant: 0, revoke: 0 }))
vi.mock("server-only", () => ({}))
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "aff_000001", role: "AFFILIATE" } })) }))
vi.mock("@/lib/api-rate-limit", () => ({
  rateLimitClientKey: () => "k",
  rateLimitResponseAsync: vi.fn(async () => null),
}))
vi.mock("@/lib/copilot-autonomy.server", () => ({
  listAutonomyRules: vi.fn(async () => ({ rules: [], available: true })),
  grantAutonomy: vi.fn(async () => {
    calls.grant += 1
    return { ok: true }
  }),
  revokeAutonomy: vi.fn(async () => {
    calls.revoke += 1
    return { ok: true }
  }),
}))
vi.mock("@/lib/reseller-action-plan.server", () => ({
  applyCopilotAction: vi.fn(async () => {
    calls.apply += 1
    return { ok: true, auditId: "aud_000001", action: {} }
  }),
  undoCopilotAction: vi.fn(async () => {
    calls.undo += 1
    return { ok: true }
  }),
}))

import { POST as apply } from "@/app/api/affiliate/copilot/actions/route"
import { POST as undo } from "@/app/api/affiliate/copilot/actions/undo/route"
import { DELETE as revoke, POST as grant } from "@/app/api/affiliate/copilot/autonomy/route"

const req = (url: string, body: unknown, headers: Record<string, string>) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

/** Cookie-authenticated copilot writes refuse a cross-site request BEFORE touching anything. */
describe("copilot write routes: same-site only", () => {
  beforeEach(() => {
    calls.apply = 0
    calls.undo = 0
    calls.grant = 0
    calls.revoke = 0
  })

  it("a cross-site origin is refused and nothing is applied or undone", async () => {
    const evil = { origin: "https://evil.example" }
    expect((await apply(req("https://affisell.com/x", { actionId: "reprice:lst_000001" }, evil))).status).toBe(403)
    expect((await undo(req("https://affisell.com/x", { auditId: "aud_000001" }, evil))).status).toBe(403)
    const grantBody = { actionType: "reprice", maxPriceIncreaseBps: 1000, maxRunsPerWeek: 5, consent: true }
    expect((await grant(req("https://affisell.com/x", grantBody, evil))).status).toBe(403)
    const del = new Request("https://affisell.com/x?actionType=reprice", { method: "DELETE", headers: evil })
    expect((await revoke(del)).status).toBe(403)
    expect(calls).toEqual({ apply: 0, undo: 0, grant: 0, revoke: 0 })
  })

  it("a same-origin request goes through", async () => {
    const same = { "sec-fetch-site": "same-origin" }
    expect((await apply(req("https://affisell.com/x", { actionId: "reprice:lst_000001" }, same))).status).toBe(200)
    expect((await undo(req("https://affisell.com/x", { auditId: "aud_000001" }, same))).status).toBe(200)
    const grantBody = { actionType: "reprice", maxPriceIncreaseBps: 1000, maxRunsPerWeek: 5, consent: true }
    expect((await grant(req("https://affisell.com/x", grantBody, same))).status).toBe(200)
    const del = new Request("https://affisell.com/x?actionType=reprice", { method: "DELETE", headers: same })
    expect((await revoke(del)).status).toBe(200)
    expect(calls).toEqual({ apply: 1, undo: 1, grant: 1, revoke: 1 })
  })
})
