"use client"

import { Sparkles, Zap, Link2, BookOpen } from "lucide-react"
import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Props = {
  listingKind: string
  digitalAccessUrl: string
  digitalAccessInstructions: string
  digitalInstantDelivery: boolean
  onAccessUrlChange: (v: string) => void
  onInstructionsChange: (v: string) => void
  onInstantDeliveryChange: (v: boolean) => void
  hasError?: boolean
  className?: string
}

export function SupplierDigitalDeliveryPanel({
  listingKind,
  digitalAccessUrl,
  digitalAccessInstructions,
  digitalInstantDelivery,
  onAccessUrlChange,
  onInstructionsChange,
  onInstantDeliveryChange,
  hasError,
  className,
}: Props) {
  const t = useTranslations("supplier.digitalDelivery")
  const kind = listingKind.toUpperCase()
  if (kind !== "SOFTWARE" && kind !== "SUBSCRIPTION") return null

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-violet-300/60 bg-gradient-to-br from-violet-950 via-indigo-950 to-cyan-950 p-6 text-white shadow-[0_0_80px_-20px_rgba(124,58,237,0.55)] ring-1 ring-violet-400/20 dark:border-violet-700/50",
        hasError && "border-red-400 ring-2 ring-red-500/40",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl"
        aria-hidden
      />

      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
          <Sparkles className="h-6 w-6 text-violet-200" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-300">{t("badge")}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{t("title")}</h3>
          <p className="mt-1 text-sm leading-relaxed text-violet-100/85">{t("description")}</p>
        </div>
      </div>

      <div className="relative mt-6 space-y-5">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition hover:bg-white/10">
          <input
            type="checkbox"
            checked={digitalInstantDelivery}
            onChange={(e) => onInstantDeliveryChange(e.target.checked)}
            className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-400"
          />
          <span className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4 text-amber-300" aria-hidden />
            {t("instantLabel")}
          </span>
        </label>

        <div>
          <Label htmlFor="digital-access-url" className="flex items-center gap-2 text-violet-100">
            <Link2 className="h-4 w-4 text-cyan-300" aria-hidden />
            {t("urlLabel")} <span className="text-red-300">*</span>
          </Label>
          <p className="mt-1 text-xs text-violet-200/70">{t("urlHint")}</p>
          <Input
            id="digital-access-url"
            className="mt-2 border-white/15 bg-black/30 text-white placeholder:text-violet-300/40"
            value={digitalAccessUrl}
            onChange={(e) => onAccessUrlChange(e.target.value)}
            placeholder="https://course.example.com/enroll?ref={{orderId}}&token={{token}}"
            autoComplete="off"
          />
        </div>

        <div>
          <Label htmlFor="digital-access-instructions" className="flex items-center gap-2 text-violet-100">
            <BookOpen className="h-4 w-4 text-emerald-300" aria-hidden />
            {t("instructionsLabel")}
          </Label>
          <textarea
            id="digital-access-instructions"
            className="mt-2 min-h-[88px] w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-violet-300/40 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            value={digitalAccessInstructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            placeholder={t("instructionsPlaceholder")}
          />
        </div>
      </div>
    </section>
  )
}
