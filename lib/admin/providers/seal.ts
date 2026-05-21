import { sealFulfillmentSecret } from "@/lib/suppliers/crypto"

export function sealProviderCredentials(credentials: {
  apiKey?: string
  apiSecret?: string
}): string | null {
  const apiKey = credentials.apiKey?.trim()
  const apiSecret = credentials.apiSecret?.trim()
  if (!apiKey && !apiSecret) return null
  return sealFulfillmentSecret(
    JSON.stringify({
      ...(apiKey ? { apiKey } : {}),
      ...(apiSecret ? { apiSecret } : {}),
    })
  )
}
