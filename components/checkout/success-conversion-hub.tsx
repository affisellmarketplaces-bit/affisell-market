"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Loader2, ShieldCheck, Star } from "lucide-react"
import { useTranslations } from "next-intl"

import type { PaymentSuccessPayload } from "@/components/checkout/payment-success-screen"
import { HomePersonalizedPicksRailLive } from "@/components/home/home-personalized-picks-rail-live"
import {
  requestPriceAlertPushSubscription,
} from "@/components/push/request-price-alert-push"
import { buttonVariants } from "@/components/ui/button"
import {
  brandOrbitTrustStripShell,
  brandOrbitTrustStripShimmer,
  brandOrbitTrustStripText,
} from "@/lib/affisell-brand-orbit-shared"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"
import { PUSH_SW_PATH } from "@/lib/push-subscribe-shared"
import { buildSuccessReviewHref } from "@/lib/success-review-href"
import { cn } from "@/lib/utils"

const EMPTY_PICKS: BuyerPersonalizedPicksPayload = {
  items: [],
  personalized: false,
}

type Props = {
  payload: PaymentSuccessPayload
}

type PushOptInState = "loading" | "hidden" | "prompt" | "enabled"

async function detectPushOptInState(): Promise<PushOptInState> {
  if (typeof window === "undefined") return "hidden"
  if (!("Notification" in window) || !("PushManager" in window)) return "hidden"
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()) return "hidden"

  const registration = await navigator.serviceWorker.getRegistration(PUSH_SW_PATH)
  const sub = await registration?.pushManager.getSubscription()
  if (sub) return "enabled"
  if (Notification.permission === "denied") return "hidden"
  return "prompt"
}

function SuccessTrustBand() {
  const t = useTranslations("PublicNav")

  return (
    <div
      data-testid="success-trust-band"
      className={cn(brandOrbitTrustStripShell, "rounded-2xl border-t border-white/10")}
      role="region"
      aria-label={t("trustStripText")}
    >
      <div className={brandOrbitTrustStripShimmer} aria-hidden />
      <p className={cn(brandOrbitTrustStripText, "relative justify-center px-3 py-2.5")}>
        <ShieldCheck className="size-3.5 shrink-0 text-emerald-300" aria-hidden />
        <span className="truncate">{t("trustStripText")}</span>
      </p>
    </div>
  )
}

function SuccessReviewCta({
  affiliateProductId,
  orderId,
}: {
  affiliateProductId: string
  orderId: string
}) {
  const t = useTranslations("success.hub")

  return (
    <div
      data-testid="success-review-cta"
      className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/60 p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-zinc-950 dark:to-indigo-950/20"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
            {t("reviewEyebrow")}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{t("reviewTitle")}</p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t("reviewHint")}</p>
        </div>
        <Link
          href={buildSuccessReviewHref(affiliateProductId, orderId)}
          className={cn(
            buttonVariants({ size: "default" }),
            "inline-flex shrink-0 items-center justify-center gap-2 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
          )}
        >
          <Star className="size-4" aria-hidden />
          {t("reviewCta")}
        </Link>
      </div>
    </div>
  )
}

function SuccessPushOptIn() {
  const t = useTranslations("success.hub")
  const [state, setState] = useState<PushOptInState>("loading")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setState(await detectPushOptInState())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function enable() {
    setBusy(true)
    try {
      const result = await requestPriceAlertPushSubscription()
      if (result === "granted") {
        setState("enabled")
        console.log("[success-hub]", { result: "push_enabled" })
      } else if (result === "denied") {
        setState("hidden")
      } else {
        setState("hidden")
      }
    } finally {
      setBusy(false)
    }
  }

  if (state === "loading") {
    return (
      <div
        data-testid="success-push-opt-in"
        className="flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("pushLoading")}
      </div>
    )
  }

  if (state !== "prompt") return null

  return (
    <div
      data-testid="success-push-opt-in"
      className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 dark:border-zinc-800 dark:bg-zinc-950/70"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <Bell className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
            {t("pushTitle")}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("pushBody")}</p>
        </div>
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0 border-violet-200 hover:bg-violet-50 dark:border-violet-800 dark:hover:bg-violet-950/40"
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("pushEnable")}
        </button>
      </div>
    </div>
  )
}

function SuccessRecommendedRail() {
  return (
    <div data-testid="success-recommended-rail">
      <HomePersonalizedPicksRailLive initialPicks={EMPTY_PICKS} variant="compact" className="mb-0" />
    </div>
  )
}

/** Post-checkout LTV hub — trust, review CTA, push opt-in, personalized picks. */
export function SuccessConversionHub({ payload }: Props) {
  if (!payload.paid || payload.error) return null

  const reviewListingId = payload.affiliateProductId?.trim()
  const reviewOrderId = payload.orderId?.trim()

  return (
    <div data-testid="success-conversion-hub" className="mt-8 space-y-4">
      <SuccessTrustBand />
      {reviewListingId && reviewOrderId ? (
        <SuccessReviewCta affiliateProductId={reviewListingId} orderId={reviewOrderId} />
      ) : null}
      <SuccessPushOptIn />
      <SuccessRecommendedRail />
    </div>
  )
}
