import { afterEach, describe, expect, it } from "vitest"

import { mustEnforceProductionSecrets, webhookSecretGate } from "@/lib/require-production-secret"

describe("mustEnforceProductionSecrets", () => {
  const env = process.env

  afterEach(() => {
    process.env = env
  })

  it("is true on Vercel even outside production NODE_ENV", () => {
    process.env = { ...env, NODE_ENV: "development", VERCEL: "1" }
    expect(mustEnforceProductionSecrets()).toBe(true)
  })
})

describe("webhookSecretGate", () => {
  const env = process.env

  afterEach(() => {
    process.env = env
  })

  it("requires secret in production", () => {
    process.env = { ...env, NODE_ENV: "production", VERCEL: undefined }
    expect(webhookSecretGate("")).toBe("missing_prod")
    expect(webhookSecretGate(undefined)).toBe("missing_prod")
  })

  it("allows dev without secret", () => {
    process.env = { ...env, NODE_ENV: "development", VERCEL: undefined }
    expect(webhookSecretGate("")).toBe("missing_sig")
    expect(webhookSecretGate("abc")).toBe(null)
  })
})
