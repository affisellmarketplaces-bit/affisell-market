import { describe, expect, it, afterEach } from "vitest"

import {
  ENCRYPTION_KEY_MISSING,
  EncryptionKeyError,
  getEncryptionKey,
  hasEncryptionKey,
} from "@/lib/radar/encryption"

describe("getEncryptionKey", () => {
  const prevEnc = process.env.ENCRYPTION_KEY
  const prevTiktok = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY

  afterEach(() => {
    if (prevEnc === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = prevEnc
    if (prevTiktok === undefined) delete process.env.TIKTOK_TOKEN_ENCRYPTION_KEY
    else process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = prevTiktok
  })

  it("throws ENCRYPTION_KEY_MISSING when absent", () => {
    delete process.env.ENCRYPTION_KEY
    delete process.env.TIKTOK_TOKEN_ENCRYPTION_KEY
    expect(hasEncryptionKey()).toBe(false)
    try {
      getEncryptionKey()
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(EncryptionKeyError)
      expect((e as EncryptionKeyError).code).toBe(ENCRYPTION_KEY_MISSING)
      expect((e as Error).message).toContain("openssl rand -hex 16")
    }
  })

  it("throws when length < 32", () => {
    process.env.ENCRYPTION_KEY = "too-short"
    expect(hasEncryptionKey()).toBe(false)
    expect(() => getEncryptionKey()).toThrow(EncryptionKeyError)
  })

  it("accepts openssl rand -hex 16 (32 hex chars via sha256)", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(32)
    expect(hasEncryptionKey()).toBe(true)
    expect(getEncryptionKey()).toHaveLength(32)
  })

  it("accepts 64 hex as raw AES key", () => {
    process.env.ENCRYPTION_KEY = "ab".repeat(32)
    const key = getEncryptionKey()
    expect(key).toHaveLength(32)
    expect(key.equals(Buffer.from("ab".repeat(32), "hex"))).toBe(true)
  })
})
