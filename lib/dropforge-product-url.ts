/** DropForge — shared product URL guards (client + server). */

import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url"

export type DropForgeUrlValidation =
  | { ok: true; url: string }
  | { ok: false; error: string; code: "empty" | "https" | "homepage" | "invalid" | "blocked" }

function isMarketplaceProductPath(hostname: string, pathname: string): boolean | null {
  const host = hostname.toLowerCase()
  const path = pathname.replace(/\/+$/, "") || "/"

  if (/aliexpress\.(com|us)/i.test(host)) {
    return /\/item\/\d{6,}/i.test(path)
  }
  if (/temu\.com/i.test(host)) {
    return path !== "/" && path.length >= 8
  }
  if (/amazon\./i.test(host) || /amzn\.to/i.test(host)) {
    return /\/(dp|gp\/product)\//i.test(path)
  }
  if (/shein\.com/i.test(host)) {
    return path !== "/" && path.length >= 8
  }
  if (/tiktok\.com/i.test(host) || /shop\.tiktok/i.test(host)) {
    return path !== "/" && path.length >= 8
  }
  // Unknown host — allow (Shopify / custom stores)
  return null
}

/**
 * Reject marketplace homepages that cannot yield a product fiche.
 * Soft rule: only enforced for known marketplaces.
 */
export function validateDropForgeProductUrl(raw: string): DropForgeUrlValidation {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: "Colle une URL produit.", code: "empty" }
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      error: "L’URL doit commencer par http:// ou https://",
      code: "https",
    }
  }

  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    return { ok: false, error: "URL invalide.", code: "invalid" }
  }

  const safe = assertSafeOutboundUrl(trimmed, { allowHttp: true })
  if (!safe.ok) {
    if (safe.code === "protocol") {
      return {
        ok: false,
        error: "L’URL doit commencer par http:// ou https://",
        code: "https",
      }
    }
    return {
      ok: false,
      error: "Cette URL n’est pas autorisée (hôte privé / local).",
      code: "blocked",
    }
  }

  const productOk = isMarketplaceProductPath(u.hostname, u.pathname)
  if (productOk === false) {
    return {
      ok: false,
      error: "Colle le lien d’un produit précis, pas la page d’accueil.",
      code: "homepage",
    }
  }

  return { ok: true, url: trimmed }
}
