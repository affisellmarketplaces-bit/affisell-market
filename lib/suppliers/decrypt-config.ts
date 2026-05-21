import type { FulfillmentProvider } from "@prisma/client"

import { openFulfillmentSecret } from "@/lib/suppliers/crypto"
import type { DecryptedConfig } from "@/lib/suppliers/dto"

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** Merge public `apiConfig` with decrypted credentials JSON. */
export function decryptProviderConfig(provider: Pick<FulfillmentProvider, "apiConfig" | "credentialsEncrypted">): DecryptedConfig {
  const base = asRecord(provider.apiConfig)
  const out: DecryptedConfig = { ...base }

  if (typeof base.endpoint === "string") out.apiEndpoint = base.endpoint
  if (typeof base.apiEndpoint === "string") out.apiEndpoint = base.apiEndpoint
  if (typeof base.timeout === "number") out.timeoutMs = base.timeout
  if (typeof base.timeoutMs === "number") out.timeoutMs = base.timeoutMs

  const sealed = provider.credentialsEncrypted?.trim()
  if (!sealed) return out

  try {
    const plain = openFulfillmentSecret(sealed)
    const secrets = JSON.parse(plain) as Record<string, unknown>
    if (typeof secrets.apiKey === "string") out.apiKey = secrets.apiKey
    if (typeof secrets.apiSecret === "string") out.apiSecret = secrets.apiSecret
    if (typeof secrets.oauthToken === "string") out.oauthToken = secrets.oauthToken
    Object.assign(out, secrets)
  } catch {
    out.apiKey = openFulfillmentSecret(sealed)
  }

  return out
}
