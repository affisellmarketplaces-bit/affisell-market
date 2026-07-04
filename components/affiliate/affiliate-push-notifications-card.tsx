"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import {
  disablePushNotifications,
  requestPriceAlertPushSubscription,
} from "@/components/push/request-price-alert-push"
import { PUSH_SW_PATH } from "@/lib/push-subscribe-shared"

type PushState = "loading" | "unsupported" | "off" | "on"

async function detectPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported"
  if (!("Notification" in window) || !("PushManager" in window)) return "unsupported"
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()) return "unsupported"

  const registration = await navigator.serviceWorker.getRegistration(PUSH_SW_PATH)
  const sub = await registration?.pushManager.getSubscription()
  if (sub) return "on"
  return "off"
}

export function AffiliatePushNotificationsCard() {
  const t = useTranslations("affiliate.earnings.push")
  const [state, setState] = useState<PushState>("loading")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setState(await detectPushState())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function enable() {
    setBusy(true)
    try {
      const result = await requestPriceAlertPushSubscription()
      if (result === "granted") {
        toast.success(t("enabledToast"))
        setState("on")
      } else if (result === "denied") {
        toast.error(t("deniedToast"))
        setState("off")
      } else {
        toast.message(t("unsupportedToast"))
        setState("unsupported")
      }
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const ok = await disablePushNotifications()
      if (ok) {
        toast.success(t("disabledToast"))
        setState("off")
      } else {
        toast.error(t("disableFailed"))
      }
    } finally {
      setBusy(false)
    }
  }

  if (state === "loading") {
    return (
      <BentoCard className="flex items-center gap-3 border-zinc-200/80 p-5 dark:border-zinc-800">
        <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("loading")}</p>
      </BentoCard>
    )
  }

  if (state === "unsupported") return null

  const enabled = state === "on"

  return (
    <BentoCard className="border-brand/25 p-6 dark:border-brand/30">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          {enabled ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("title")}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("body")}</p>
          <Button
            type="button"
            variant={enabled ? "outline" : "default"}
            size="sm"
            className="mt-4"
            disabled={busy}
            onClick={() => void (enabled ? disable() : enable())}
          >
            {busy ? t("loading") : enabled ? t("disable") : t("enable")}
          </Button>
        </div>
      </div>
    </BentoCard>
  )
}
