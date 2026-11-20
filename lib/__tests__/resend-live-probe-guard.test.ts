import { readFileSync } from "node:fs"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Proof (no network) that the live Resend probe can only ever write to the team test inbox and leaks nothing:
 * the REAL `sendResendEmail` + the REAL recipient resolver + the probe's guards, with the Resend SDK replaced by a
 * recorder. Also pins the workflow file itself (trigger, permissions, pinned actions, no input injection).
 */
const sent = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>>, failFirst: false }))
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: Record<string, unknown>) => {
        sent.calls.push(payload)
        if (sent.failFirst) {
          // Resend's sandbox refusal echoes the address — lower-cased.
          return { data: null, error: { name: "validation_error", message: `You can only send testing emails to your own email address (${String(payload.to).toLowerCase()}).` } }
        }
        return { data: { id: `em_${sent.calls.length}` }, error: null }
      },
    }
  },
}))

import { sendResendEmail } from "@/lib/emails/resend-delivery"
import { assertProbeEnvironment, assertRoutesToTestInbox, PROBE_NOMINAL_RECIPIENT } from "@/lib/emails/live-probe-guard"

const KEY = "re_test_PLANTED_SECRET_123"
const INBOX = "Team.Inbox@Example.com" // mixed case on purpose: GitHub masks the secret's EXACT text only
const SANDBOX = "Affisell test <onboarding@resend.dev>"
const config = { apiKey: KEY, from: SANDBOX, testEmailTo: INBOX }

let logs: string[] = []
beforeEach(() => {
  sent.calls = []
  sent.failFirst = false
  logs = []
  delete process.env.VERCEL_ENV
  for (const level of ["log", "warn", "error", "info"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logs.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")))
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.VERCEL_ENV
})

/** The probe's 17 sends: guard, then the app's own sending function. */
async function runProbeSends() {
  for (let i = 0; i < 17; i++) {
    assertRoutesToTestInbox(config)
    await sendResendEmail({ context: "live-resend-probe", config, intendedTo: PROBE_NOMINAL_RECIPIENT, subject: `[TEST Affisell] ${i}`, html: "<p>x</p>", idempotencyKey: `k:${i}` })
  }
}

describe("environment guard — refuses before anything is sent", () => {
  it("refuses: no key, production, a non-sandbox sender, no or malformed test inbox", () => {
    expect(() => assertProbeEnvironment(null)).toThrow(/RESEND_API_KEY/)
    expect(() => assertProbeEnvironment({ from: "Affisell <noreply@affisell.com>", testEmailTo: INBOX })).toThrow(/sandbox/)
    expect(() => assertProbeEnvironment({ from: SANDBOX, testEmailTo: "" })).toThrow(/TEST_EMAIL_TO/)
    expect(() => assertProbeEnvironment({ from: SANDBOX, testEmailTo: "not-an-address" })).toThrow(/TEST_EMAIL_TO/)
    process.env.VERCEL_ENV = "production"
    expect(() => assertProbeEnvironment(config)).toThrow(/production/)
  })
  it("in production the app would write to the nominal recipient — so the per-send guard stops it", () => {
    process.env.VERCEL_ENV = "production"
    expect(() => assertRoutesToTestInbox(config)).toThrow(/nothing sent/)
  })
  it("accepts the probe's configuration", () => {
    expect(assertProbeEnvironment(config)).toEqual({ from: SANDBOX, testInbox: INBOX.toLowerCase() })
  })
})

describe("destination of every e-mail the probe sends", () => {
  it("all 17 go to the test inbox, from the sandbox sender, with no cc / bcc / reply-to", async () => {
    await runProbeSends()
    expect(sent.calls).toHaveLength(17)
    for (const p of sent.calls) {
      expect(p.to).toBe(INBOX.toLowerCase())
      expect(p.from).toBe(SANDBOX)
      expect(Object.keys(p).sort()).toEqual(["from", "html", "subject", "to"])
    }
  })
  it("when Resend refuses, nothing goes elsewhere (the fallback target IS the test inbox, so it does not even run)", async () => {
    sent.failFirst = true
    await runProbeSends()
    expect(new Set(sent.calls.map((p) => p.to))).toEqual(new Set([INBOX.toLowerCase()]))
    expect(sent.calls).toHaveLength(17)
  })
  it("the nominal recipient is on the reserved .invalid domain (RFC 2606: never deliverable)", () => {
    expect(PROBE_NOMINAL_RECIPIENT.endsWith(".invalid")).toBe(true)
  })
})

describe("nothing secret reaches the logs", () => {
  it.each([false, true])("success and refusal paths (refusal=%s): no key, no full address, in any case", async (fail) => {
    sent.failFirst = fail
    await runProbeSends()
    const all = logs.join("\n")
    expect(all).not.toContain(KEY)
    expect(all.toLowerCase()).not.toContain(INBOX.toLowerCase())
    expect(all).not.toContain(PROBE_NOMINAL_RECIPIENT)
    if (fail) expect(all).toContain("[email]") // the provider's message is kept, its address removed
  })
})

describe("the workflow file", () => {
  const wf = readFileSync(path.resolve(__dirname, "../../.github/workflows/resend-live-probe.yml"), "utf8")
  const onBlock = wf.slice(wf.indexOf("\non:"), wf.indexOf("\npermissions:"))
  it("is manual only: no push, pull_request, pull_request_target, schedule or workflow_run trigger", () => {
    expect(onBlock).toMatch(/workflow_dispatch:/)
    expect(onBlock).not.toMatch(/\b(push|pull_request|pull_request_target|schedule|workflow_run|repository_dispatch):/)
  })
  it("token: read-only contents, nothing else", () => {
    expect(wf).toMatch(/\npermissions:\n {2}contents: read\n/)
    expect(wf).not.toMatch(/(write-all|: write\b|id-token)/)
  })
  it("every action is pinned to a full commit SHA", () => {
    const uses = [...wf.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]!)
    expect(uses.length).toBeGreaterThan(0)
    for (const u of uses) expect(u, u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/)
  })
  it("secrets live in the protected environment, and only after the provenance check", () => {
    expect(wf).toMatch(/environment: resend-probe/)
    const firstSecret = wf.search(/\$\{\{\s*secrets\./)
    expect(firstSecret).toBeGreaterThan(wf.indexOf("Refuse unreviewed code or an unexpected branch"))
    expect(wf).not.toMatch(/upload-artifact|actions\/cache@|cache: npm/)
  })
  it("no ${{ … }} expression inside a run: script (inputs reach the shell through env only — no injection)", () => {
    const runBlocks = wf.split(/\n\s+- (?:name|uses):/).map((step) => step.slice(step.indexOf("run:") >= 0 ? step.indexOf("run:") : step.length))
    for (const block of runBlocks) expect(block).not.toMatch(/\$\{\{/)
  })
})
