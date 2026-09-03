import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ALG = "aes-256-gcm"
const IV_BYTES = 12

export class PayoutEncryptionKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PayoutEncryptionKeyError"
  }
}

function getPayoutEncryptionKey(): Buffer {
  const raw = process.env.PAYOUT_ENCRYPTION_KEY?.trim()
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new PayoutEncryptionKeyError(
      "PAYOUT_ENCRYPTION_KEY must be 32 bytes hex (64 chars). Generate: openssl rand -hex 32"
    )
  }
  return Buffer.from(raw, "hex")
}

export function hasPayoutEncryptionKey(): boolean {
  const raw = process.env.PAYOUT_ENCRYPTION_KEY?.trim()
  return Boolean(raw && /^[0-9a-fA-F]{64}$/.test(raw))
}

/** AES-256-GCM payload: `ivHex:tagHex:cipherHex` */
export function encryptPayoutDetails(obj: Record<string, unknown>): string {
  const key = getPayoutEncryptionKey()
  const iv = randomBytes(IV_BYTES)
  const plaintext = JSON.stringify(obj)
  const cipher = createCipheriv(ALG, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`
}

export function decryptPayoutDetails(str: string): Record<string, unknown> {
  const parts = str.split(":")
  if (parts.length !== 3) {
    throw new Error("[payout-encryption] Invalid ciphertext format")
  }
  const [ivHex, tagHex, encHex] = parts
  const key = getPayoutEncryptionKey()
  const iv = Buffer.from(ivHex!, "hex")
  const tag = Buffer.from(tagHex!, "hex")
  const enc = Buffer.from(encHex!, "hex")
  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  const out = Buffer.concat([decipher.update(enc), decipher.final()])
  return JSON.parse(out.toString("utf8")) as Record<string, unknown>
}

export function normalizePayoutDetailsForFingerprint(
  type: string,
  details: Record<string, unknown>
): Record<string, unknown> {
  switch (type) {
    case "BANK":
      return {
        type,
        iban: String(details.iban ?? "")
          .replace(/\s/g, "")
          .toUpperCase(),
        bic: String(details.bic ?? "")
          .replace(/\s/g, "")
          .toUpperCase(),
        holderName: String(details.holderName ?? "")
          .trim()
          .toLowerCase(),
      }
    case "PAYPAL":
    case "WISE":
    case "PAYONEER":
      return {
        type,
        email: String(details.email ?? "")
          .trim()
          .toLowerCase(),
      }
    case "MOBILE_MONEY_WAVE":
    case "MOBILE_MONEY_ORANGE":
    case "MOBILE_MONEY_MTN":
      return {
        type,
        phone: String(details.phone ?? "").replace(/\s/g, ""),
        fullName: String(details.fullName ?? "")
          .trim()
          .toLowerCase(),
      }
    default:
      return { type, ...details }
  }
}

export function hashFingerprint(type: string, normalizedDetails: Record<string, unknown>): string {
  const payload = JSON.stringify(normalizePayoutDetailsForFingerprint(type, normalizedDetails))
  return createHash("sha256").update(payload).digest("hex")
}

export function getLast4(type: string, details: Record<string, unknown>): string {
  switch (type) {
    case "BANK": {
      const iban = String(details.iban ?? "").replace(/\s/g, "")
      return iban.slice(-4).padStart(4, "*") || "****"
    }
    case "PAYPAL":
    case "WISE":
    case "PAYONEER": {
      const email = String(details.email ?? "").trim().toLowerCase()
      const at = email.indexOf("@")
      if (at <= 0) return "****"
      const domain = email.slice(at + 1)
      return domain.slice(0, 10) || "****"
    }
    case "MOBILE_MONEY_WAVE":
    case "MOBILE_MONEY_ORANGE":
    case "MOBILE_MONEY_MTN": {
      const digits = String(details.phone ?? "").replace(/\D/g, "")
      return digits.slice(-4).padStart(4, "*") || "****"
    }
    default:
      return "****"
  }
}
