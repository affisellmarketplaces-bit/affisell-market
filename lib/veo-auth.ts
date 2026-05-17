import { existsSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

import { videoLog } from "@/lib/video-logger"

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"] as const
const TOKEN_REFRESH_BUFFER_MS = 60_000
const DEFAULT_TOKEN_TTL_MS = 3_600_000
const AFFISELL_KEY_PATTERN = /^affisell-.+\.json$/i

type GoogleAuthModule = typeof import("google-auth-library")
type GoogleAuthInstance = InstanceType<GoogleAuthModule["GoogleAuth"]>

let authSingleton: GoogleAuthInstance | null = null
let tokenCache: { token: string; expiresAt: number } | null = null

async function loadGoogleAuth(): Promise<GoogleAuthModule> {
  return import("google-auth-library")
}

function parseCredentialsFile(filePath: string): Record<string, unknown> {
  const raw = readFileSync(filePath, "utf8")
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new Error(`Invalid JSON in GCP credentials file: ${filePath}`)
  }
}

/** Local dev: affisell-*.json, then GOOGLE_APPLICATION_CREDENTIALS path, then gcp-service-account.json */
function loadLocalGcpCredentialsFromDisk(): Record<string, unknown> | null {
  if (typeof process === "undefined" || !process.versions?.node) return null

  const cwd = process.cwd()

  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (envPath) {
    const resolved = resolve(cwd, envPath)
    if (existsSync(resolved)) {
      return parseCredentialsFile(resolved)
    }
  }

  let affisellFiles: string[] = []
  try {
    affisellFiles = readdirSync(cwd)
      .filter((name) => AFFISELL_KEY_PATTERN.test(name))
      .sort()
  } catch {
    return null
  }

  if (affisellFiles.length > 0) {
    if (affisellFiles.length > 1) {
      videoLog.warn("veo.auth.multiple_affisell_keys", { using: affisellFiles[0], found: affisellFiles.length })
    }
    return parseCredentialsFile(resolve(cwd, affisellFiles[0]))
  }

  const legacy = resolve(cwd, "gcp-service-account.json")
  if (existsSync(legacy)) {
    return parseCredentialsFile(legacy)
  }

  return null
}

async function createGoogleAuth(): Promise<GoogleAuthInstance> {
  const { GoogleAuth } = await loadGoogleAuth()
  if (existsSync(resolve(process.cwd(), "affisell-vertex.json"))) {
    return new GoogleAuth({
      keyFilename: "./affisell-vertex.json",
      scopes: [...SCOPES],
    })
  }

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

  const fromDisk = loadLocalGcpCredentialsFromDisk()
  if (fromDisk) {
    return new GoogleAuth({ credentials: fromDisk, scopes: [...SCOPES] })
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
      "Failed to obtain Google Cloud access token. Set GOOGLE_APPLICATION_CREDENTIALS_JSON (Vercel) or place affisell-*.json at repo root (local)."
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

/** For diagnostics (test-veo): which auth source is active. */
export function getVeoAuthSource(): string {
  if (existsSync(resolve(process.cwd(), "affisell-vertex.json"))) {
    return "affisell-vertex.json (keyFilename)"
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim()) {
    return "GOOGLE_APPLICATION_CREDENTIALS_JSON"
  }
  return "ADC"
}
