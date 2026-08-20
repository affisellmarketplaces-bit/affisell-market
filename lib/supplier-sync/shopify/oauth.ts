import { createHmac, randomBytes } from "node:crypto"

const STATE_TTL_MS = 10 * 60 * 1000

export type ShopifyOAuthState = {
  userId: string
  shop: string
  ts: number
  nonce: string
}

function stateSecret(): string {
  return (
    process.env.SHOPIFY_API_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  )
}

export function signShopifyOAuthState(payload: Omit<ShopifyOAuthState, "nonce"> & { nonce?: string }): string {
  const secret = stateSecret()
  if (!secret) throw new Error("Missing SHOPIFY_API_SECRET or CRON_SECRET for OAuth state")
  const body: ShopifyOAuthState = {
    ...payload,
    nonce: payload.nonce ?? randomBytes(12).toString("hex"),
    ts: payload.ts ?? Date.now(),
  }
  const data = Buffer.from(JSON.stringify(body), "utf8").toString("base64url")
  const sig = createHmac("sha256", secret).update(data, "utf8").digest("base64url")
  return `${data}.${sig}`
}

export function parseShopifyOAuthState(state: string): ShopifyOAuthState | null {
  const secret = stateSecret()
  if (!secret || !state.includes(".")) return null
  const [data, sig] = state.split(".")
  if (!data || !sig) return null
  const expected = createHmac("sha256", secret).update(data, "utf8").digest("base64url")
  if (expected !== sig) return null
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as ShopifyOAuthState
    if (!parsed.userId || !parsed.shop || !parsed.ts) return null
    if (Date.now() - parsed.ts > STATE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function buildShopifyAuthUrl(args: { shop: string; state: string; scopes?: string }): string {
  const key = process.env.SHOPIFY_API_KEY?.trim()
  const appUrl = (process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  if (!key || !appUrl) throw new Error("SHOPIFY_API_KEY and SHOPIFY_APP_URL required")
  const scopes =
    args.scopes?.trim() ||
    "read_products,read_inventory"
  const redirectUri = `${appUrl}/api/integrations/shopify/callback`
  const params = new URLSearchParams({
    client_id: key,
    scope: scopes,
    redirect_uri: redirectUri,
    state: args.state,
  })
  return `https://${args.shop}/admin/oauth/authorize?${params.toString()}`
}

export async function exchangeShopifyOAuthCode(args: {
  shop: string
  code: string
}): Promise<{ accessToken: string; scope: string } | { error: string }> {
  const key = process.env.SHOPIFY_API_KEY?.trim()
  const secret = process.env.SHOPIFY_API_SECRET?.trim()
  if (!key || !secret) return { error: "Shopify app credentials missing" }

  const url = `https://${args.shop}/admin/oauth/access_token`
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: key, client_secret: secret, code: args.code }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "OAuth token exchange failed" }
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    return { error: typeof json.error_description === "string" ? json.error_description : `HTTP ${res.status}` }
  }
  const accessToken = typeof json.access_token === "string" ? json.access_token : ""
  const scope = typeof json.scope === "string" ? json.scope : ""
  if (accessToken.length < 16) return { error: "Invalid access token from Shopify" }
  return { accessToken, scope }
}
