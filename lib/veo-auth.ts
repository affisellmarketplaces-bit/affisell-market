import { videoLog } from "@/lib/video-logger"

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"] as const
const TOKEN_REFRESH_BUFFER_MS = 60_000
const DEFAULT_TOKEN_TTL_MS = 3_600_000

type GoogleAuthModule = typeof import("google-auth-library")
type GoogleAuthInstance = InstanceType<GoogleAuthModule["GoogleAuth"]>

let authSingleton: GoogleAuthInstance | null = null
let tokenCache: { token: string; expiresAt: number } | null = null

async function loadGoogleAuth(): Promise<GoogleAuthModule> {
  return import("google-auth-library")
}

async function defaultLocalKeyPath(): Promise<string | undefined> {
  if (typeof process === "undefined" || !process.versions?.node) return undefined
  try {
    const { existsSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const local = resolve(process.cwd(), "gcp-service-account.json")
    return existsSync(local) ? local : undefined
  } catch {
    return undefined
  }
}

async function createGoogleAuth(): Promise<GoogleAuthInstance> {
  const { GoogleAuth } = await loadGoogleAuth()
  const jsonRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim()

  if (jsonRaw) {
    let credentials: Record<string, unknown>
    try {
      credentials = JSON.parse(jsonRaw) as Record<string, unknown>
    } catch {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON")
    }
    return new GoogleAuth({ credentials, scopes: [...SCOPES] })
  }

  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  const keyFilename = envPath || (await defaultLocalKeyPath())
  if (keyFilename) {
    return new GoogleAuth({ keyFilename, scopes: [...SCOPES] })
  }

  return new GoogleAuth({ scopes: [...SCOPES] })
}

async function getAuthClient(): Promise<GoogleAuthInstance> {
  if (!authSingleton) {
    authSingleton = await createGoogleAuth()
  }
  return authSingleton
}

/** OAuth2 access token for Vertex AI (cached until ~1 min before expiry). */
export async function getVeoAccessToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && now < tokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
    return tokenCache.token
  }

  const auth = await getAuthClient()
  const result = await auth.getAccessToken()
  const token =
    result == null
      ? null
      : typeof result === "string"
        ? result
        : ((result as { token?: string | null }).token ?? null)
  if (!token) {
    throw new Error(
      "Failed to obtain Google Cloud access token. Set GOOGLE_APPLICATION_CREDENTIALS_JSON (Vercel) or GOOGLE_APPLICATION_CREDENTIALS / gcp-service-account.json (local)."
    )
  }

  const client = await auth.getClient()
  const expiryDate = (client as { credentials?: { expiry_date?: number } }).credentials?.expiry_date
  tokenCache = {
    token,
    expiresAt: expiryDate && expiryDate > now ? expiryDate : now + DEFAULT_TOKEN_TTL_MS,
  }

  return token
}

export async function veoAuthorizedFetch(
  input: string,
  init: RequestInit = {},
  opts: { maxRetries?: number } = {}
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 3
  let lastRes: Response | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const token = await getVeoAccessToken()
    const headers = new Headers(init.headers)
    headers.set("Authorization", `Bearer ${token}`)
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }

    const res = await fetch(input, { ...init, headers })

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = res.headers.get("retry-after")
      const delayMs = retryAfter
        ? Math.min(Number(retryAfter) * 1000, 30_000) || 2_000
        : Math.min(1_000 * 2 ** attempt, 8_000)
      videoLog.warn("veo.rate_limited", { attempt: attempt + 1, delayMs })
      await new Promise((r) => setTimeout(r, delayMs))
      lastRes = res
      continue
    }

    return res
  }

  return lastRes ?? new Response(null, { status: 429 })
}
