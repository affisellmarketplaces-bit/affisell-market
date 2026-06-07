import { afterEach, describe, expect, it, vi } from "vitest"

import {
  authorizeMetaWebhookRequest,
  signMetaWebhookPayload,
  verifyMetaWebhookSignature,
} from "@/lib/meta-ai-webhook"

describe("verifyMetaWebhookSignature", () => {
  it("accepts valid HMAC header", () => {
    const secret = "test-secret"
    const body = '{"jobId":"j1"}'
    const sig = signMetaWebhookPayload(body, secret)
    expect(verifyMetaWebhookSignature(body, sig, secret)).toBe(true)
  })

  it("rejects invalid signature", () => {
    expect(verifyMetaWebhookSignature("{}", "sha256=deadbeef", "secret")).toBe(false)
  })
})

describe("authorizeMetaWebhookRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns missing_prod when secret unset on Vercel", () => {
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("META_WEBHOOK_SECRET", "")
    expect(authorizeMetaWebhookRequest("{}", null)).toBe("missing_prod")
  })

  it("returns ok in local dev when secret unset", () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("META_WEBHOOK_SECRET", "")
    expect(authorizeMetaWebhookRequest("{}", null)).toBe("ok")
  })

  it("returns unauthorized when secret set but signature missing", () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("META_WEBHOOK_SECRET", "prod-secret")
    expect(authorizeMetaWebhookRequest("{}", null)).toBe("unauthorized")
  })

  it("returns ok when signature matches", () => {
    vi.stubEnv("META_WEBHOOK_SECRET", "prod-secret")
    const body = '{"productId":"p1"}'
    const sig = signMetaWebhookPayload(body, "prod-secret")
    expect(authorizeMetaWebhookRequest(body, sig)).toBe("ok")
  })
})
