import { createHmac, timingSafeEqual } from "node:crypto"

/** Verify Shopify OAuth query HMAC or webhook body HMAC. */
export function verifyShopifyHmac(args: {
  secret: string
  rawBody: string
  hmacHeader: string | null
}): boolean {
  const { secret, rawBody, hmacHeader } = args
  if (!secret || !hmacHeader?.trim()) return false
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64")
  try {
    const a = Buffer.from(digest)
    const b = Buffer.from(hmacHeader.trim())
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Verify Shopify OAuth redirect query params (exclude hmac + signature). */
export function verifyShopifyOAuthQuery(searchParams: URLSearchParams, secret: string): boolean {
  const hmac = searchParams.get("hmac")
  if (!hmac) return false
  const pairs: string[] = []
  searchParams.forEach((value, key) => {
    if (key === "hmac" || key === "signature") return
    pairs.push(`${key}=${value}`)
  })
  pairs.sort()
  const message = pairs.join("&")
  const digest = createHmac("sha256", secret).update(message, "utf8").digest("hex")
  try {
    const a = Buffer.from(digest, "utf8")
    const b = Buffer.from(hmac, "utf8")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
