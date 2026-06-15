import { expansionCountryLabel } from "@/lib/admin/load-admin-expansion-overview"
import {
  invalidateCheckoutRolloutCache,
  loadGraduatedCheckoutCountryIso2,
} from "@/lib/checkout-country-rollout"
import { stripeCheckoutAllowedCountriesForRegion } from "@/lib/eu-market-countries"
import { logBusiness } from "@/lib/business-log"
import { sendCheckoutCountryLaunchEmail } from "@/lib/emails/send-checkout-country-launch"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

const NOTIFY_BATCH_SIZE = 200

export type EnableCheckoutCountryResult =
  | { ok: true; countryIso2: string; created: boolean }
  | { ok: false; error: "invalid_country" | "already_base_country" }

export async function enableCheckoutCountryRollout(
  countryRaw: string
): Promise<EnableCheckoutCountryResult> {
  const countryIso2 = normalizeVisitorCountryIso2(countryRaw)
  if (!countryIso2) return { ok: false, error: "invalid_country" }

  const baseCountries = new Set(
    [
      ...stripeCheckoutAllowedCountriesForRegion(MARKET_REGION).map((code) => code.toUpperCase()),
      ...(await loadGraduatedCheckoutCountryIso2(MARKET_REGION)),
    ]
  )
  const existing = await prisma.checkoutCountryRollout.findUnique({
    where: {
      countryIso2_marketRegion: { countryIso2, marketRegion: MARKET_REGION },
    },
  })

  if (baseCountries.has(countryIso2) && !existing) {
    return { ok: false, error: "already_base_country" }
  }

  const created = !existing
  await prisma.checkoutCountryRollout.upsert({
    where: {
      countryIso2_marketRegion: { countryIso2, marketRegion: MARKET_REGION },
    },
    create: { countryIso2, marketRegion: MARKET_REGION, enabled: true },
    update: { enabled: true, updatedAt: new Date() },
  })

  invalidateCheckoutRolloutCache()
  logBusiness("checkout-rollout", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: created ? "enabled" : "reenabled",
  })

  return { ok: true, countryIso2, created }
}

export type NotifyCheckoutCountryResult = {
  ok: true
  countryIso2: string
  sent: number
  skipped: number
  failed: number
}

export async function notifyCheckoutCountryWaitlist(
  countryRaw: string
): Promise<NotifyCheckoutCountryResult | { ok: false; error: string }> {
  const countryIso2 = normalizeVisitorCountryIso2(countryRaw)
  if (!countryIso2) return { ok: false, error: "invalid_country" }

  const rollout = await prisma.checkoutCountryRollout.findUnique({
    where: {
      countryIso2_marketRegion: { countryIso2, marketRegion: MARKET_REGION },
    },
  })
  if (!rollout?.enabled) {
    return { ok: false, error: "country_not_enabled" }
  }

  const waiters = await prisma.checkoutLaunchWaitlist.findMany({
    where: {
      countryIso2,
      marketRegion: MARKET_REGION,
      launchNotifiedAt: null,
      launchEmailSuppressedAt: null,
    },
    orderBy: { createdAt: "asc" },
    take: NOTIFY_BATCH_SIZE,
    select: { id: true, email: true, locale: true },
  })

  let sent = 0
  let failed = 0
  const countryNameEn = expansionCountryLabel(countryIso2, "en")
  const countryNameFr = expansionCountryLabel(countryIso2, "fr")

  for (const waiter of waiters) {
    const locale = waiter.locale === "en" ? "en" : "fr"
    const countryName = locale === "en" ? countryNameEn : countryNameFr
    const result = await sendCheckoutCountryLaunchEmail({
      email: waiter.email,
      countryIso2,
      countryName,
      locale: waiter.locale,
    })

    if (result.ok) {
      await prisma.checkoutLaunchWaitlist.update({
        where: { id: waiter.id },
        data: { launchNotifiedAt: new Date() },
      })
      sent += 1
    } else {
      failed += 1
      console.error("[launch-waitlist]", {
        country: countryIso2,
        email: waiter.email,
        result: "email_failed",
        error: result.error,
      })
    }
  }

  if (sent > 0 || waiters.length === 0) {
    await prisma.checkoutCountryRollout.update({
      where: { id: rollout.id },
      data: { launchEmailSentAt: new Date() },
    })
  }

  logBusiness("launch-waitlist", {
    country: countryIso2,
    marketRegion: MARKET_REGION,
    result: "notify_batch",
    sent,
    failed,
    batchSize: waiters.length,
  })

  return {
    ok: true,
    countryIso2,
    sent,
    skipped: 0,
    failed,
  }
}
