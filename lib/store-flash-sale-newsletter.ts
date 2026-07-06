import { sendStoreFlashSaleAlertEmail } from "@/lib/emails/send-store-flash-sale-alert"
import { prisma } from "@/lib/prisma"
import { storePublicUrl } from "@/lib/store-public-url"
import {
  resolveFlashSaleNewsletterCampaign,
} from "@/lib/store-flash-sale-newsletter.shared"
import { mergeStorefrontBrandOps } from "@/lib/storefront-theme-ops-shared"
import { asStorefrontThemeJson } from "@/lib/storefront-theme-json.server"
import { parseStorefrontTheme, type StorefrontTheme } from "@/lib/storefront-theme-shared"
import { pickFlashSaleProducts } from "@/lib/storefront-flash-sale-shared"

const SUBSCRIBER_BATCH = 200

export type MaybeNotifyFlashSaleNewsletterInput = {
  storeId: string
  storeName: string
  slug: string
  customDomain: string | null
  domainVerified: boolean
  previousTheme: StorefrontTheme
  nextTheme: StorefrontTheme
}

export type FlashSaleNewsletterBlastResult = {
  campaignKey: string
  subscribers: number
  emailsSent: number
  skipped: number
  errors: string[]
}

async function loadFlashSaleListings(listingIds: string[]) {
  if (listingIds.length === 0) return []
  const rows = await prisma.affiliateProduct.findMany({
    where: { id: { in: listingIds }, isListed: true },
    select: {
      id: true,
      sellingPriceCents: true,
      product: { select: { name: true } },
    },
  })
  const mapped = rows.map((row) => ({
    listingId: row.id,
    name: row.product.name,
    priceCents: row.sellingPriceCents,
  }))
  return pickFlashSaleProducts(mapped, listingIds)
}

async function markFlashSaleCampaignNotified(
  storeId: string,
  currentThemeJson: unknown,
  campaignKey: string
): Promise<void> {
  const theme = parseStorefrontTheme(currentThemeJson)
  const nextBrandOps = mergeStorefrontBrandOps(theme.brandOps, {
    flashSaleNewsletterCampaignKey: campaignKey,
  })
  await prisma.store.update({
    where: { id: storeId },
    data: {
      storefrontTheme: asStorefrontThemeJson({ ...theme, brandOps: nextBrandOps }),
    },
  })
}

export async function runFlashSaleNewsletterBlast(
  input: MaybeNotifyFlashSaleNewsletterInput
): Promise<FlashSaleNewsletterBlastResult | null> {
  const previousKey = input.previousTheme.brandOps?.flashSaleNewsletterCampaignKey
  const campaign = resolveFlashSaleNewsletterCampaign({
    sections: input.nextTheme.homepageSections,
    previousCampaignKey: previousKey,
  })
  if (!campaign) return null

  const { campaignKey, config } = campaign
  const subscribers = await prisma.storeNewsletterSubscriber.findMany({
    where: {
      storeId: input.storeId,
      OR: [{ lastFlashSaleAlertKey: null }, { lastFlashSaleAlertKey: { not: campaignKey } }],
    },
    take: SUBSCRIBER_BATCH,
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, locale: true },
  })

  const listings = await loadFlashSaleListings(config.listingIds)
  const shopUrl = storePublicUrl({
    slug: input.slug,
    customDomain: input.customDomain,
    domainVerified: input.domainVerified,
    role: "AFFILIATE",
  })

  let emailsSent = 0
  let skipped = 0
  const errors: string[] = []

  for (const sub of subscribers) {
    const sent = await sendStoreFlashSaleAlertEmail({
      to: sub.email,
      storeName: input.storeName,
      shopUrl,
      config,
      listings,
      locale: sub.locale,
    })
    if (!sent.ok) {
      errors.push(`${sub.id}:${sent.error ?? "send_failed"}`)
      skipped += 1
      continue
    }
    await prisma.storeNewsletterSubscriber.update({
      where: { id: sub.id },
      data: { lastFlashSaleAlertKey: campaignKey },
    })
    emailsSent += 1
  }

  const storeRow = await prisma.store.findUnique({
    where: { id: input.storeId },
    select: { storefrontTheme: true },
  })
  if (storeRow) {
    await markFlashSaleCampaignNotified(input.storeId, storeRow.storefrontTheme, campaignKey)
  }

  console.log("[store-flash-sale-newsletter]", {
    storeId: input.storeId,
    campaignKey,
    subscribers: subscribers.length,
    emailsSent,
    skipped,
    result: "blast_complete",
  })

  return {
    campaignKey,
    subscribers: subscribers.length,
    emailsSent,
    skipped,
    errors,
  }
}

/** Fire-and-forget after Brand Studio save — does not block the HTTP response. */
export function maybeNotifyFlashSaleNewsletter(input: MaybeNotifyFlashSaleNewsletterInput): void {
  void runFlashSaleNewsletterBlast(input).catch((error) => {
    console.error("[store-flash-sale-newsletter]", {
      storeId: input.storeId,
      result: "blast_failed",
      error,
    })
  })
}
