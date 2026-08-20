import { createHash } from "node:crypto"

export const INTEGRATION_ENCRYPTION_KEY_MISSING = "INTEGRATION_ENCRYPTION_KEY_MISSING" as const

export class IntegrationEncryptionKeyError extends Error {
  readonly code = INTEGRATION_ENCRYPTION_KEY_MISSING

  constructor(
    message = "Set INTEGRATION_ENCRYPTION_KEY or ENCRYPTION_KEY (openssl rand -hex 32)"
  ) {
    super(message)
    this.name = "IntegrationEncryptionKeyError"
  }
}

function rawKeyFromEnv(): string {
  return (
    process.env.INTEGRATION_ENCRYPTION_KEY?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.TIKTOK_TOKEN_ENCRYPTION_KEY?.trim() ||
    ""
  )
}

export function hasIntegrationEncryptionKey(): boolean {
  return rawKeyFromEnv().length >= 32
}

/** 32-byte AES-256 key — same derivation as lib/radar/encryption.ts */
export function getIntegrationEncryptionKey(): Buffer {
  const raw = rawKeyFromEnv()
  if (!raw || raw.length < 32) {
    throw new IntegrationEncryptionKeyError()
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex")
  }
  return createHash("sha256").update(raw, "utf8").digest()
}
