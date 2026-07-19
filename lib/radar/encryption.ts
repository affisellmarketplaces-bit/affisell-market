import { createHash } from "node:crypto"

export const ENCRYPTION_KEY_MISSING = "ENCRYPTION_KEY_MISSING" as const

export class EncryptionKeyError extends Error {
  readonly code = ENCRYPTION_KEY_MISSING

  constructor(
    message = "Add ENCRYPTION_KEY=openssl rand -hex 16 in Vercel"
  ) {
    super(message)
    this.name = "EncryptionKeyError"
  }
}

function rawEncryptionKeyFromEnv(): string {
  return (
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.TIKTOK_TOKEN_ENCRYPTION_KEY?.trim() ||
    ""
  )
}

/** True when ENCRYPTION_KEY (or TikTok alias) is set with length ≥ 32. */
export function hasEncryptionKey(): boolean {
  return rawEncryptionKeyFromEnv().length >= 32
}

/**
 * Resolves a 32-byte AES-256 key.
 * - 64 hex chars → raw 32 bytes (preferred)
 * - any string length ≥ 32 → SHA-256 digest (supports `openssl rand -hex 16`)
 * - missing / short → throws ENCRYPTION_KEY_MISSING
 */
export function getEncryptionKey(): Buffer {
  const raw = rawEncryptionKeyFromEnv()
  if (!raw || raw.length < 32) {
    console.error("[radar/encryption]", {
      result: "missing",
      code: ENCRYPTION_KEY_MISSING,
    })
    throw new EncryptionKeyError()
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex")
  }

  // openssl rand -hex 16 → 32 hex chars, or any passphrase ≥ 32 chars
  return createHash("sha256").update(raw, "utf8").digest()
}
