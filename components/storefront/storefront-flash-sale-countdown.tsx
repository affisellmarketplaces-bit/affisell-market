"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import {
  flashSaleRemainingMs,
  formatFlashSaleCountdownParts,
  isFlashSaleActive,
} from "@/lib/storefront-flash-sale-shared"
import { cn } from "@/lib/utils"

type Props = {
  endsAt: string
  className?: string
  onExpired?: () => void
}

export function StorefrontFlashSaleCountdown({ endsAt, className, onExpired }: Props) {
  const t = useTranslations("storefront.flashSale")
  const [remainingMs, setRemainingMs] = useState(() => flashSaleRemainingMs(endsAt))

  useEffect(() => {
    const tick = () => {
      const next = flashSaleRemainingMs(endsAt)
      setRemainingMs(next)
      if (next <= 0) onExpired?.()
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [endsAt, onExpired])

  if (!isFlashSaleActive(endsAt) || remainingMs <= 0) return null

  const { days, hours, minutes, seconds } = formatFlashSaleCountdownParts(remainingMs)
  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <div
      className={cn("flex items-center gap-1.5 tabular-nums", className)}
      role="timer"
      aria-live="polite"
      aria-label={t("countdownAria")}
      data-testid="flash-sale-countdown"
    >
      {days > 0 ? (
        <span className="rounded-lg bg-black/20 px-2 py-1 text-sm font-bold text-white">
          {days}
          <span className="ml-0.5 text-[10px] font-semibold uppercase opacity-80">{t("days")}</span>
        </span>
      ) : null}
      <span className="rounded-lg bg-black/20 px-2 py-1 text-sm font-bold text-white">
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  )
}
