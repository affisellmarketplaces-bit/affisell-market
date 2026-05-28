"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"

import { PulseHeaderCartLink } from "@/components/pulse/pulse-header-cart-link"
import { useEffect } from "react"
import { useTranslations } from "next-intl"

import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("pulse")
  const tErr = useTranslations("errors.page")

  useEffect(() => {
    console.error("[discover error]", {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <div
      data-testid="affisell-pulse-error"
      className={cn(
        affisellBrand.epoxyPage,
        "affisell-swipe-commerce fixed inset-0 z-[140] flex flex-col items-center justify-center px-6 text-center"
      )}
    >
      <div className={affisellBrand.epoxyCanvas} aria-hidden />
      <div className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-20">
        <PulseHeaderCartLink />
      </div>
      <div className={cn(affisellBrand.epoxyPanel, "relative z-10 max-w-sm p-8")}>
        <Sparkles className="mx-auto mb-4 size-10 text-violet-300" aria-hidden />
        <p className="text-lg font-semibold text-white">{tErr("title")}</p>
        <p className="mt-2 text-sm text-zinc-300">{tErr("body")}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className={cn(
              affisellBrand.epoxyCta,
              "rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-900"
            )}
          >
            {tErr("retry")}
          </button>
          <Link
            href="/"
            className={cn(
              affisellBrand.epoxyChip,
              "inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white/90"
            )}
          >
            {tErr("home")}
          </Link>
        </div>
        <Link
          href="/discover"
          className="mt-4 inline-block text-xs text-violet-200 underline-offset-2 hover:underline"
        >
          {t("brand")}
        </Link>
      </div>
    </div>
  )
}
