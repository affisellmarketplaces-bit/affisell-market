import "server-only"

import type { Prisma } from "@prisma/client"

import { decryptString, encryptString, hasEncryptionKey } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"

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

  try {
    await prisma.platformOAuthCredential.upsert({
      where: { provider: ALIEXPRESS_OAUTH_PROVIDER },
      create: {
        provider: ALIEXPRESS_OAUTH_PROVIDER,
        accessTokenEncrypted: encryptString(args.accessToken.trim()),
        refreshTokenEncrypted: encryptString(args.refreshToken.trim()),
        accessExpiresAt: args.accessExpiresAt ?? null,
        refreshExpiresAt: args.refreshExpiresAt ?? null,
        accountHint: args.accountHint ?? null,
        meta: metaJson,
      },
      update: {
        accessTokenEncrypted: encryptString(args.accessToken.trim()),
        refreshTokenEncrypted: encryptString(args.refreshToken.trim()),
        accessExpiresAt: args.accessExpiresAt ?? null,
        refreshExpiresAt: args.refreshExpiresAt ?? null,
        accountHint: args.accountHint ?? null,
        meta: metaJson,
      },
    })
    console.log("[aliexpress-token-store]", {
      result: "saved",
      access: maskTail(args.accessToken),
      refresh: maskTail(args.refreshToken),
      accessExpiresAt: args.accessExpiresAt?.toISOString() ?? null,
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[aliexpress-token-store]", { result: "save_error", message })
    return { ok: false, error: message }
  }
}

/** Load decrypted tokens from DB, or null. */
export async function loadAliExpressTokensFromDb(): Promise<AliExpressStoredTokens | null> {
  if (!hasEncryptionKey()) return null
  try {
    const row = await prisma.platformOAuthCredential.findUnique({
      where: { provider: ALIEXPRESS_OAUTH_PROVIDER },
    })
    if (!row) return null
    return {
      accessToken: decryptString(row.accessTokenEncrypted),
      refreshToken: decryptString(row.refreshTokenEncrypted),
      accessExpiresAt: row.accessExpiresAt,
      refreshExpiresAt: row.refreshExpiresAt,
      accountHint: row.accountHint,
      source: "db",
    }
  } catch (err) {
    console.error("[aliexpress-token-store]", {
      result: "load_error",
      message: err instanceof Error ? err.message : String(err),
    })
    return null
  }
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

export async function loadAliExpressTokens(): Promise<AliExpressStoredTokens | null> {
  const fromDb = await loadAliExpressTokensFromDb()
  if (fromDb?.accessToken || fromDb?.refreshToken) return fromDb
  return loadAliExpressTokensFromEnv()
}

export function expiresWithinMs(expiresAt: Date | null | undefined, withinMs: number): boolean {
  if (!expiresAt) return true
  return expiresAt.getTime() - Date.now() <= withinMs
}
