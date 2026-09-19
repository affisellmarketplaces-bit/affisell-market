import "server-only"

import type { Prisma } from "@prisma/client"

import { decryptString, encryptString, hasEncryptionKey } from "@/lib/crypto"
import { fulfillmentPrisma, prisma } from "@/lib/prisma"

export const ALIEXPRESS_OAUTH_PROVIDER = "aliexpress" as const

export type AliExpressStoredTokens = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: Date | null
  refreshExpiresAt: Date | null
  accountHint: string | null
  source: "db" | "env"
}

function maskTail(token: string): string {
  if (!token) return "(empty)"
  if (token.length <= 4) return "****"
  return `…${token.slice(-4)}`
}

/** Persist tokens encrypted in PlatformOAuthCredential (upsert). */
export async function saveAliExpressTokens(args: {
  accessToken: string
  refreshToken: string
  accessExpiresAt?: Date | null
  refreshExpiresAt?: Date | null
  accountHint?: string | null
  meta?: Record<string, unknown>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!args.accessToken.trim() || !args.refreshToken.trim()) {
    return { ok: false, error: "missing_tokens" }
  }
  if (!hasEncryptionKey()) {
    console.log("[aliexpress-token-store]", {
      result: "skip_persist",
      reason: "ENCRYPTION_KEY_missing",
      access: maskTail(args.accessToken),
    })
    return { ok: false, error: "ENCRYPTION_KEY_missing" }
  }

  const metaJson = (args.meta ?? undefined) as Prisma.InputJsonValue | undefined
  const data = {
    accessTokenEncrypted: encryptString(args.accessToken.trim()),
    refreshTokenEncrypted: encryptString(args.refreshToken.trim()),
    accessExpiresAt: args.accessExpiresAt ?? null,
    refreshExpiresAt: args.refreshExpiresAt ?? null,
    accountHint: args.accountHint ?? null,
    meta: metaJson,
  }

  // AliExpress ROTATES the refresh token on every refresh: losing this write means the session is dead for good.
  // So: retry on the pooled client, then once more on the direct (unpooled) connection.
  let lastMessage = "unknown"
  const clients = [prisma, prisma, prisma, fulfillmentPrisma]
  for (let attempt = 0; attempt < clients.length; attempt++) {
    try {
      await clients[attempt].platformOAuthCredential.upsert({
        where: { provider: ALIEXPRESS_OAUTH_PROVIDER },
        create: { provider: ALIEXPRESS_OAUTH_PROVIDER, ...data },
        update: data,
      })
      console.log("[aliexpress-token-store]", {
        result: "saved",
        attempt: attempt + 1,
        access: maskTail(args.accessToken),
        refresh: maskTail(args.refreshToken),
        accessExpiresAt: args.accessExpiresAt?.toISOString() ?? null,
      })
      return { ok: true }
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : String(err)
      console.error("[aliexpress-token-store]", { result: "save_error", attempt: attempt + 1, message: lastMessage })
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  return { ok: false, error: lastMessage }
}

export type AliExpressDbTokenState =
  | { status: "ok"; tokens: AliExpressStoredTokens }
  | { status: "missing" }
  | { status: "error"; message: string }

/**
 * Load decrypted tokens from DB. Distinguishes "no row" from "database unreachable": callers must NEVER treat an
 * outage as "no session" (that used to fall through to stale env tokens and kill the refresh chain).
 */
export async function loadAliExpressTokenState(): Promise<AliExpressDbTokenState> {
  if (!hasEncryptionKey()) return { status: "missing" }
  let lastMessage = "unknown"
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await prisma.platformOAuthCredential.findUnique({
        where: { provider: ALIEXPRESS_OAUTH_PROVIDER },
      })
      if (!row) return { status: "missing" }
      return {
        status: "ok",
        tokens: {
          accessToken: decryptString(row.accessTokenEncrypted),
          refreshToken: decryptString(row.refreshTokenEncrypted),
          accessExpiresAt: row.accessExpiresAt,
          refreshExpiresAt: row.refreshExpiresAt,
          accountHint: row.accountHint,
          source: "db",
        },
      }
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : String(err)
      console.error("[aliexpress-token-store]", { result: "load_error", attempt: attempt + 1, message: lastMessage })
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  return { status: "error", message: lastMessage }
}

/** Load decrypted tokens from DB, or null (missing OR error — prefer loadAliExpressTokenState). */
export async function loadAliExpressTokensFromDb(): Promise<AliExpressStoredTokens | null> {
  const state = await loadAliExpressTokenState()
  return state.status === "ok" ? state.tokens : null
}

/** Env bootstrap (Vercel) — no expiry metadata unless ALIEXPRESS_ACCESS_EXPIRES_AT set. */
export function loadAliExpressTokensFromEnv(): AliExpressStoredTokens | null {
  const accessToken = process.env.ALIEXPRESS_ACCESS_TOKEN?.trim() ?? ""
  const refreshToken = process.env.ALIEXPRESS_REFRESH_TOKEN?.trim() ?? ""
  if (!accessToken && !refreshToken) return null

  const expiresRaw = process.env.ALIEXPRESS_ACCESS_EXPIRES_AT?.trim()
  let accessExpiresAt: Date | null = null
  if (expiresRaw) {
    const n = Number(expiresRaw)
    if (Number.isFinite(n) && n > 0) {
      accessExpiresAt = new Date(n > 1e12 ? n : n * 1000)
    } else {
      const d = new Date(expiresRaw)
      if (!Number.isNaN(d.getTime())) accessExpiresAt = d
    }
  }

  return {
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt: null,
    accountHint: null,
    source: "env",
  }
}

/** Raised when the token store cannot be read (DB outage) — transient, never "reconnect OAuth". */
export class AliExpressTokenStoreUnavailableError extends Error {
  constructor(message: string) {
    super(`AliExpress token store temporarily unavailable: ${message}`)
    this.name = "AliExpressTokenStoreUnavailableError"
  }
}

export async function loadAliExpressTokens(): Promise<AliExpressStoredTokens | null> {
  const state = await loadAliExpressTokenState()
  if (state.status === "ok" && (state.tokens.accessToken || state.tokens.refreshToken)) return state.tokens
  // Env tokens are a one-time bootstrap only: with a DB outage they are stale (already rotated) — do not use them.
  if (state.status === "error") throw new AliExpressTokenStoreUnavailableError(state.message)
  return loadAliExpressTokensFromEnv()
}

export function expiresWithinMs(expiresAt: Date | null | undefined, withinMs: number): boolean {
  if (!expiresAt) return true
  return expiresAt.getTime() - Date.now() <= withinMs
}
