import { createHmac } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Finalisation master doc, C4 (defence in depth): when REPLICATE_WEBHOOK_SECRET is configured, the try-on webhook must
// verify the Replicate (Standard Webhooks) signature over the raw body. The body itself is still never trusted.

const findJob = vi.fn()
vi.mock("@sentry/nextjs", () => ({
  withScope: async (fn: (scope: { setTag: () => void }) => unknown) => fn({ setTag: () => {} }),
  captureException: vi.fn(),
}))
vi.mock("@/lib/try-on/cloth2body-api.server", () => ({ deleteSelfieBlob: vi.fn(async () => {}) }))
vi.mock("@/lib/try-on/try-on-service.server", () => ({ getTryOnJobStatus: vi.fn(async () => ({ status: "processing" })) }))
vi.mock("@/lib/prisma", () => ({ prisma: { tryOnJob: { findUnique: (arg: unknown) => findJob(arg) } } }))

import { POST as tryOnWebhook } from "@/app/api/try-on/webhook/route"
import { verifyReplicateWebhook } from "@/lib/try-on/replicate-webhook-verify"

const KEY = Buffer.from("0123456789abcdef0123456789abcdef")
const SECRET = `whsec_${KEY.toString("base64")}`
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0)

function sign(id: string, timestamp: string, body: string, key: Buffer = KEY) {
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`
}

describe("verifyReplicateWebhook", () => {
  const body = JSON.stringify({ id: "pred_1", status: "succeeded" })
  const ts = String(Math.floor(NOW / 1000))
  const base = { secret: SECRET, id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body), body, nowMs: NOW }

  it("accepts a correctly signed request", () => {
    expect(verifyReplicateWebhook(base)).toBe(true)
  })

  it("accepts the secret without the whsec_ prefix and several signatures in the header", () => {
    expect(verifyReplicateWebhook({ ...base, secret: KEY.toString("base64") })).toBe(true)
    expect(verifyReplicateWebhook({ ...base, signature: `v1,${Buffer.from("nope").toString("base64")} ${base.signature}` })).toBe(true)
  })

  it.each([
    ["a tampered body", { body: body.replace("succeeded", "failed") }],
    ["another message id", { id: "msg_2" }],
    ["a wrong secret", { secret: `whsec_${Buffer.from("another-secret-another-secret-xx").toString("base64")}` }],
    ["a stale timestamp (> 5 min)", { nowMs: NOW + 6 * 60 * 1000 }],
    ["a future timestamp (> 5 min)", { nowMs: NOW - 6 * 60 * 1000 }],
    ["a non-numeric timestamp", { timestamp: "yesterday" }],
    ["a missing signature", { signature: null }],
    ["a missing id", { id: null }],
    ["a missing timestamp", { timestamp: null }],
    ["an unknown signature version", { signature: base.signature.replace("v1,", "v2,") }],
    ["a presence-only header (the old behaviour)", { signature: "anything" }],
    ["an empty secret", { secret: "" }],
  ])("rejects %s", (_label, over) => {
    expect(verifyReplicateWebhook({ ...base, ...(over as object) })).toBe(false)
  })
})

describe("POST /api/try-on/webhook signature", () => {
  const payload = JSON.stringify({ id: "pred_1", status: "processing" })

  function call(headers: Record<string, string> = {}) {
    return tryOnWebhook(new Request("http://localhost/api/try-on/webhook", { method: "POST", body: payload, headers }))
  }

  beforeEach(() => {
    findJob.mockReset()
    findJob.mockResolvedValue(null)
    vi.unstubAllEnvs()
  })
  afterEach(() => vi.unstubAllEnvs())

  it("rejects a request with a header but no valid signature when a secret is configured (401)", async () => {
    vi.stubEnv("REPLICATE_WEBHOOK_SECRET", SECRET)
    const res = await call({ "webhook-id": "msg_1", authorization: "Bearer whatever" })
    expect(res.status).toBe(401)
    expect(findJob).not.toHaveBeenCalled()
  })

  it("rejects a correctly formed signature made with another secret", async () => {
    vi.stubEnv("REPLICATE_WEBHOOK_SECRET", SECRET)
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await call({
      "webhook-id": "msg_1",
      "webhook-timestamp": ts,
      "webhook-signature": sign("msg_1", ts, payload, Buffer.from("a-different-signing-key-32-bytes!")),
    })
    expect(res.status).toBe(401)
  })

  it("accepts a correctly signed request and reaches the job lookup", async () => {
    vi.stubEnv("REPLICATE_WEBHOOK_SECRET", SECRET)
    const ts = String(Math.floor(Date.now() / 1000))
    const res = await call({ "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": sign("msg_1", ts, payload) })
    expect(res.status).toBe(200)
    expect(findJob).toHaveBeenCalledTimes(1)
  })

  it("keeps working without a secret (the body is never trusted), including in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("REPLICATE_WEBHOOK_SECRET", "")
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const res = await call()
    expect(res.status).toBe(200)
    expect(findJob).toHaveBeenCalledTimes(1)
  })
})
