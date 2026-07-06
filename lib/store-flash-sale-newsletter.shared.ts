/** Flash sale newsletter blast — client-safe (no Prisma). */

import {
  flashSaleFromSectionContent,
  isFlashSaleActive,
  type FlashSaleConfig,
} from "@/lib/storefront-flash-sale-shared"
import {
  getEnabledHomepageSections,
  type HomepageSection,
} from "@/lib/storefront-sections-shared"

export function buildFlashSaleCampaignKey(config: FlashSaleConfig): string {
  const sorted = [...config.listingIds].sort().join(",")
  return `${config.endsAt}|${sorted}`.slice(0, 120)
}

export function resolveFlashSaleNewsletterCampaign(args: {
  sections: HomepageSection[] | undefined
  previousCampaignKey: string | undefined
}): { campaignKey: string; config: FlashSaleConfig } | null {
  const enabled = getEnabledHomepageSections(args.sections ?? [])
  const flashSection = enabled.find((s) => s.type === "flash-sale")
  if (!flashSection) return null

  const config = flashSaleFromSectionContent(flashSection.content)
  if (!config || !isFlashSaleActive(config.endsAt)) return null

  const campaignKey = buildFlashSaleCampaignKey(config)
  if (campaignKey === args.previousCampaignKey) return null

  return { campaignKey, config }
}

export function flashSaleShopUrlWithAnchor(shopUrl: string): string {
  const base = shopUrl.trim()
  if (!base) return "#flash-sale"
  return base.includes("#") ? base : `${base.replace(/\/$/, "")}#flash-sale`
}

export function formatFlashSaleEndsAtLabel(endsAt: string, locale: "fr" | "en"): string {
  const d = new Date(endsAt)
  if (!Number.isFinite(d.getTime())) return endsAt
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}
