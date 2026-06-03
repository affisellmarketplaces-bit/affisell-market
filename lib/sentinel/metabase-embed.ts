import { createHmac } from "crypto"

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url")
}

function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const body = base64UrlEncode(JSON.stringify(payload))
  const data = `${header}.${body}`
  const signature = createHmac("sha256", secret).update(data).digest("base64url")
  return `${data}.${signature}`
}

/** Signed Metabase static embed URL, or null when env is not configured. */
export function buildMetabaseEmbedUrl(): string | null {
  const siteUrl = process.env.METABASE_SITE_URL?.trim().replace(/\/$/, "")
  const secretKey = process.env.METABASE_SECRET_KEY?.trim()
  const dashboardId = process.env.METABASE_DASHBOARD_ID?.trim()
  if (!siteUrl || !secretKey || !dashboardId) return null

  const exp = Math.floor(Date.now() / 1000) + 60 * 60
  const token = signHs256Jwt(
    {
      resource: { dashboard: Number.parseInt(dashboardId, 10) },
      params: {},
      exp,
    },
    secretKey
  )

  return `${siteUrl}/embed/dashboard/${token}#bordered=true&titled=true`
}
