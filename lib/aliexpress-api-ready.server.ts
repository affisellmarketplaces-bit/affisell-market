import "server-only"

import { getAliExpressConfigStatus, readAliExpressConfig } from "@/lib/aliexpress-config"
import { loadAliExpressTokensFromDb } from "@/lib/aliexpress-token-store"

export type AliExpressApiReadyStatus = {
  configured: boolean
  missing: string[]
  message: string
  tokenSource: "env" | "db" | "none"
  accountHint: string | null
}

/**
 * True when app credentials exist AND session tokens are in env or encrypted DB (OAuth).
 * Sync getAliExpressConfigStatus() only sees env — use this on server import paths.
 */
export async function getAliExpressApiReadyStatus(): Promise<AliExpressApiReadyStatus> {
  const config = readAliExpressConfig()
  const envStatus = getAliExpressConfigStatus(config)

  if (envStatus.configured) {
    return {
      ...envStatus,
      tokenSource: config.accessToken || config.refreshToken ? "env" : "none",
      accountHint: null,
    }
  }

  const missing = envStatus.missing.filter((m) => !/ACCESS_TOKEN|REFRESH_TOKEN/i.test(m))

  if (!config.appKey || !config.appSecret) {
    return {
      configured: false,
      missing: envStatus.missing,
      message: envStatus.message,
      tokenSource: "none",
      accountHint: null,
    }
  }

  const fromDb = await loadAliExpressTokensFromDb()
  if (fromDb?.accessToken || fromDb?.refreshToken) {
    const account = fromDb.accountHint?.trim() || null
    return {
      configured: true,
      missing: [],
      message: account
        ? `OK — session OAuth en base (${account})`
        : "OK — session OAuth chiffrée en base",
      tokenSource: "db",
      accountHint: account,
    }
  }

  missing.push(
    "Session OAuth — GET /api/aliexpress/oauth/start ou ALIEXPRESS_REFRESH_TOKEN sur Vercel"
  )

  return {
    configured: false,
    missing,
    message: `Variables manquantes : ${missing.join(", ")}.`,
    tokenSource: "none",
    accountHint: null,
  }
}

export async function isAliExpressApiReady(): Promise<boolean> {
  return (await getAliExpressApiReadyStatus()).configured
}
