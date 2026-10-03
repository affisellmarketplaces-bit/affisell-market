import "server-only"

import {
  PLATFORM_EMAIL_BRAND,
  readableTextOn,
  sanitizeBrandName,
  sanitizeHexColor,
  sanitizeHttpUrl,
  type EmailBrand,
} from "@/lib/emails/email-brand-shared"
import { prisma } from "@/lib/prisma"

function themePrimary(theme: unknown): string | null {
  if (!theme || typeof theme !== "object" || Array.isArray(theme)) return null
  return sanitizeHexColor((theme as Record<string, unknown>).primary)
}

/**
 * Brand of the reseller storefront an order was sold through. Falls back to the platform identity when there is no
 * affiliate / store, and on any lookup failure — an email must never be blocked or lost over branding.
 */
export async function resolveEmailBrandForAffiliate(affiliateId: string | null | undefined): Promise<EmailBrand> {
  if (!affiliateId) return PLATFORM_EMAIL_BRAND
  try {
    const store = await prisma.store.findUnique({
      where: { userId: affiliateId },
      select: { name: true, logoUrl: true, customDomain: true, domainVerified: true, storefrontTheme: true },
    })
    const name = sanitizeBrandName(store?.name)
    if (!store || !name) return PLATFORM_EMAIL_BRAND
    const primaryColor = themePrimary(store.storefrontTheme)
    return {
      name,
      isStore: true,
      logoUrl: sanitizeHttpUrl(store.logoUrl),
      primaryColor,
      onPrimaryColor: primaryColor ? readableTextOn(primaryColor) : null,
      siteHost: store.customDomain && store.domainVerified ? store.customDomain.trim().toLowerCase() : null,
    }
  } catch (error) {
    console.error("[email-brand] lookup_failed", {
      error: error instanceof Error ? error.message.slice(0, 160) : String(error),
    })
    return PLATFORM_EMAIL_BRAND
  }
}

export async function resolveEmailBrandForOrder(orderId: string): Promise<EmailBrand> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { affiliateId: true } })
    return resolveEmailBrandForAffiliate(order?.affiliateId)
  } catch {
    return PLATFORM_EMAIL_BRAND
  }
}
