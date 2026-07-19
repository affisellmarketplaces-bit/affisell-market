import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { getEncryptionKey } from "@/lib/radar/encryption"

const ALG = "aes-256-gcm"

export type EncryptedString = string

/**
 * Encrypts plaintext into a compact base64 payload.
 *
 * Format (base64 of JSON): { v:1, iv, tag, data }
 * Requires ENCRYPTION_KEY (length ≥ 32) — see lib/radar/encryption.ts
 */
export function encryptString(plaintext: string): EncryptedString {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, key, iv)
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload = {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: data.toString("base64"),
  }

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64")
}

export function decryptString(ciphertext: EncryptedString): string {
  const key = getEncryptionKey()
  const raw = Buffer.from(ciphertext, "base64").toString("utf8")
  const payload = JSON.parse(raw) as {
    v: number
    iv: string
    tag: string
    data: string
  }
  if (payload.v !== 1) throw new Error("Unsupported cipher payload version")
  const iv = Buffer.from(payload.iv, "base64")
  const tag = Buffer.from(payload.tag, "base64")
  const data = Buffer.from(payload.data, "base64")

  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  const out = Buffer.concat([decipher.update(data), decipher.final()])
  return out.toString("utf8")
}

export { getEncryptionKey, hasEncryptionKey, ENCRYPTION_KEY_MISSING, EncryptionKeyError } from "@/lib/radar/encryption"
