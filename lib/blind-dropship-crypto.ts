import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

const ALGO = "aes-256-gcm"
const SALT = "affisell-blind-dropship-v1"

function deriveKey(): Buffer {
  const secret = process.env.BLIND_DROPSHIP_SECRET?.trim()
  if (!secret || secret.length < 24) {
    throw new Error("BLIND_DROPSHIP_SECRET must be set (min 24 chars) for blind-dropship API key encryption")
  }
  return scryptSync(secret, SALT, 32)
}

/** Seal arbitrary UTF-8 string for storage in `BlindDropshipSupplier.apiKeyEncrypted`. */
export function sealBlindSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, deriveKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, enc, tag]).toString("base64url")
}

export function openBlindSecret(sealed: string): string {
  const buf = Buffer.from(sealed, "base64url")
  if (buf.length < 12 + 16) throw new Error("invalid_sealed_blob")
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(buf.length - 16)
  const enc = buf.subarray(12, buf.length - 16)
  const decipher = createDecipheriv(ALGO, deriveKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}
