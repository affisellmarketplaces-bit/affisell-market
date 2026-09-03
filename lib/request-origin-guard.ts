import { NextResponse } from "next/server"

import { mustEnforceProductionSecrets } from "@/lib/require-production-secret"
import { resolvePublicAppUrl } from "@/lib/public-app-url"
import { devLocalhostOrigin, resolveDevPort } from "@/lib/dev-localhost-url"
import { isAffisellStoreSubdomainHost } from "@/lib/store-host-suffix"
import { isLocalhostUrl } from "@/lib/localhost-host"

function normalizeOriginCandidate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    return new URL(withProto).origin
  } catch {
    return null
  }
}

/** Platform + preview + storefront origins allowed for cookie-auth mutations. */
export function collectAllowedRequestOrigins(): Set<string> {
  const allowed = new Set<string>()
  const add = (raw?: string | null) => {
    const origin = raw ? normalizeOriginCandidate(raw) : null
    if (origin) allowed.add(origin)
  }

  add(resolvePublicAppUrl())
  add(process.env.AFFISELL_PLATFORM_ORIGIN)
  add(process.env.NEXT_PUBLIC_APP_URL)
  add(process.env.NEXTAUTH_URL)
  add(process.env.APP_URL)

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) add(`https://${vercel.replace(/^https?:\/\//i, "")}`)

  if (!mustEnforceProductionSecrets()) {
    add(devLocalhostOrigin())
    const port = resolveDevPort()
    add(`http://127.0.0.1:${port}`)
    const altPort = port === 3001 ? 3000 : 3001
    add(`http://127.0.0.1:${altPort}`)
  }

  return allowed
}

export function isAllowedRequestOrigin(origin: string): boolean {
  const normalized = normalizeOriginCandidate(origin)
  if (!normalized) return false
  if (collectAllowedRequestOrigins().has(normalized)) return true

  try {
    const host = new URL(normalized).hostname
    if (isAffisellStoreSubdomainHost(host)) return true
    if (!mustEnforceProductionSecrets() && isLocalhostUrl(normalized)) return true
  } catch {
    return false
  }
  return false
}

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_forbidden" }, { status: 403 })
}

/**
 * CSRF defense for cookie-session mutating APIs.
 * Skips Bearer-authenticated callers (cron / machine). Rejects cross-site Origin.
 */
export function assertSameSiteRequestOrigin(req: Request): NextResponse | null {
  const authorization = req.headers.get("authorization")?.trim() ?? ""
  if (/^bearer\s+\S+/i.test(authorization)) return null

  const cronHeader = req.headers.get("x-cron-secret")?.trim()
  if (cronHeader) return null

  const secFetchSite = req.headers.get("sec-fetch-site")?.toLowerCase()
  if (secFetchSite === "same-origin") return null

  const originHeader = req.headers.get("origin")?.trim()
  if (originHeader) {
    if (isAllowedRequestOrigin(originHeader)) return null
    console.log("[origin-guard]", { result: "rejected_origin", origin: originHeader.slice(0, 80) })
    return originForbiddenResponse()
  }

  const referer = req.headers.get("referer")?.trim()
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin
      if (isAllowedRequestOrigin(refOrigin)) return null
      console.log("[origin-guard]", { result: "rejected_referer", origin: refOrigin.slice(0, 80) })
      return originForbiddenResponse()
    } catch {
      return originForbiddenResponse()
    }
  }

  // Browsers send Origin on cross-origin POST; missing Origin + Referer in prod is suspicious.
  if (mustEnforceProductionSecrets()) {
    console.log("[origin-guard]", { result: "rejected_missing_origin" })
    return originForbiddenResponse()
  }

  return null
}
