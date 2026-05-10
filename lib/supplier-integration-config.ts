import { randomBytes } from "node:crypto"

import { normalizeShopifyAdminHost } from "@/lib/shopify-sync-map"

export function maskIntegrationConfig(config: unknown): Record<string, unknown> {
  const o =
    config && typeof config === "object" && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {}
  if (typeof o.accessToken === "string") {
    const t = o.accessToken
    o.accessToken = t.length > 10 ? `…${t.slice(-4)}` : "…"
  }
  if (typeof o.webhookSecret === "string") {
    const t = o.webhookSecret
    o.webhookSecret = t.length > 8 ? `…${t.slice(-4)}` : "…"
  }
  return o
}

export function normalizeIntegrationName(name: unknown): string {
  const s = typeof name === "string" ? name.trim().toLowerCase() : ""
  const slug = s
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return slug.length ? slug : "main"
}

export function normalizePlatform(p: unknown): string | null {
  if (typeof p !== "string" || !p.trim()) return null
  const s = p.trim().toLowerCase()
  if (s === "shopify" || s === "webhook") return s
  return null
}

export function parseShopifyIntegrationConfig(
  config: unknown
): { shopHost: string; accessToken: string; apiVersion?: string } | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null
  const c = config as Record<string, unknown>
  const shopHost = normalizeShopifyAdminHost(
    typeof c.shop === "string" ? c.shop : ""
  )
  const accessToken =
    typeof c.accessToken === "string" ? c.accessToken.trim() : ""
  if (!shopHost || accessToken.length < 16) return null
  const apiVersion =
    typeof c.apiVersion === "string" && c.apiVersion.trim()
      ? c.apiVersion.trim()
      : undefined
  return { shopHost, accessToken, apiVersion }
}

export function newWebhookSecret(): string {
  return randomBytes(24).toString("hex")
}
