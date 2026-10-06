"use client"

import { ArrowRight, BadgeCheck, Check, ExternalLink, Loader2, Store, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  deriveStorefrontMode,
  displayStoreAddress,
  STORE_DOMAIN_CHANGED_EVENT,
  type BrandDomainStage,
  type BrandStepId,
  type StorefrontModeInput,
} from "@/lib/storefront/storefront-mode"
import { cn } from "@/lib/utils"

type StatusPayload = StorefrontModeInput & {
  /** Where buyers land now (the custom domain once its DNS is verified). */
  publicStoreUrl?: string
  /** The store's address on Affisell, whatever the custom domain is doing. */
  platformStoreUrl?: string
}

type Props = {
  /** "studio": full card with the upgrade path. "compact": one tight block, e.g. above the domain form. */
  variant?: "studio" | "compact"
  /** Opens / focuses the domain setup in place (Brand Studio). */
  onManageDomain?: () => void
  /** Fallback when there is no in-page handler: an anchor to the domain form. */
  manageHref?: string
  className?: string
}

const POLL_MS = 12_000

/** The merchant's storefront type — Affisell showcase or Brand store on their own domain — and the way from one to the other. */
export function StorefrontModeCard({ variant = "studio", onManageDomain, manageHref, className }: Props) {
  const t = useTranslations("storefront.mode")
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/store/domain-status", { credentials: "include", cache: "no-store" })
      if (!res.ok) {
        setFailed(true)
        return
      }
      setStatus((await res.json()) as StatusPayload)
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    void load()
    // The domain form announces every save / verify, so this card follows without a reload.
    window.addEventListener(STORE_DOMAIN_CHANGED_EVENT, load)
    return () => window.removeEventListener(STORE_DOMAIN_CHANGED_EVENT, load)
  }, [load])

  const info = useMemo(() => (status ? deriveStorefrontMode(status) : null), [status])

  // While the certificate is being issued nothing is left for the merchant to do — just keep the card truthful.
  const stage = info?.stage
  useEffect(() => {
    if (stage !== "ssl_pending") return
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [stage, load])

  if (failed && !info) return null // never show a guess about the store type

  if (!info) {
    return (
      <div
        aria-busy
        className={cn("h-32 animate-pulse rounded-3xl bg-zinc-100/80 dark:bg-zinc-900/60", className)}
      >
        <span className="sr-only">{t("loading")}</span>
      </div>
    )
  }

  const isBrand = info.mode === "brand"
  // A showcase lives on Affisell; only a live brand store lives on the merchant's domain. A verified-but-not-yet-HTTPS domain
  // must not be presented as the store's address.
  const addressUrl = isBrand ? status?.publicStoreUrl : (status?.platformStoreUrl ?? status?.publicStoreUrl)
  const address = displayStoreAddress(addressUrl)
  const typeLabel = isBrand ? t("brand.badge") : t("vitrine.badge")
  const compact = variant === "compact"

  const ctaLabel =
    info.stage === "live"
      ? t("cta.manage")
      : info.stage === "none"
        ? t("cta.connect")
        : info.stage === "ssl_failed"
          ? t("cta.retry")
          : t("cta.continue")

  const cta =
    onManageDomain ? (
      <Button type="button" variant={isBrand ? "outline" : "bentoSolid"} size="bento" onClick={onManageDomain}>
        {ctaLabel}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    ) : manageHref ? (
      <a
        href={manageHref}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500"
      >
        {ctaLabel}
        <ArrowRight className="size-4" aria-hidden />
      </a>
    ) : null

  // The full card already states the upgrade pitch and shows the three steps; the extra line is for the compact one.
  const hint = info.stage === "live" || (info.stage === "none" && !compact) ? null : t(`hints.${info.stage}`)

  return (
    <section
      aria-label={t("ariaLabel", { type: typeLabel })}
      data-testid="storefront-mode"
      data-mode={info.mode}
      data-stage={info.stage}
      className={cn(
        "relative overflow-hidden rounded-3xl border",
        compact ? "p-4" : "p-5 md:p-6",
        isBrand
          ? "border-emerald-300/70 bg-gradient-to-br from-emerald-50 via-white to-violet-50/70 dark:border-emerald-800/50 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-violet-950/20"
          : "border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-sky-50/70 dark:border-violet-900/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-sky-950/20",
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl ring-1",
              compact ? "size-10" : "size-12",
              isBrand
                ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
                : "bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300"
            )}
          >
            {isBrand ? <BadgeCheck className="size-6" /> : <Store className="size-6" />}
          </span>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {t("eyebrow")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className={cn("font-bold tracking-tight text-zinc-900 dark:text-zinc-50", compact ? "text-base" : "text-lg")}>
                {isBrand ? t("brand.title") : t("vitrine.title")}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                  isBrand
                    ? "bg-emerald-600 text-white"
                    : "bg-violet-600 text-white"
                )}
              >
                {typeLabel}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {isBrand
                ? t("brand.body", { domain: info.domain ?? address ?? "" })
                : t("vitrine.body", { address: address ?? "affisell.com" })}
            </p>
            {!isBrand && !compact ? (
              <p className="mt-1 text-sm font-medium text-violet-900 dark:text-violet-200">{t("vitrine.upgrade")}</p>
            ) : null}
            {address ? (
              <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{t("currentAddress")}</span>
                <a
                  href={addressUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 break-all font-mono font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                >
                  {address}
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              </p>
            ) : null}
          </div>
        </div>

        {cta ? <div className="shrink-0">{cta}</div> : null}
      </div>

      <ProgressRail
        steps={info.steps}
        stage={info.stage}
        labels={{
          domain: t("steps.domain"),
          dns: t("steps.dns"),
          https: t("steps.https"),
        }}
        compact={compact}
      />

      {hint ? (
        <p
          role="status"
          className={cn(
            "mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed",
            info.stage === "ssl_failed"
              ? "border-rose-300/60 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100"
              : "border-violet-200/70 bg-white/70 text-violet-950 dark:border-violet-900/40 dark:bg-zinc-950/50 dark:text-violet-100"
          )}
        >
          {info.stage === "ssl_failed" ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : info.stage === "ssl_pending" ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
          ) : null}
          <span>
            {info.stage !== "none" ? <strong className="font-semibold">{t(`progress.${info.stage}`)} · </strong> : null}
            {hint}
          </span>
        </p>
      ) : null}
    </section>
  )
}

function ProgressRail({
  steps,
  stage,
  labels,
  compact,
}: {
  steps: { id: BrandStepId; done: boolean; current: boolean }[]
  stage: BrandDomainStage
  labels: Record<BrandStepId, string>
  compact: boolean
}) {
  return (
    <ol className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0", compact ? "mt-3" : "mt-5")}>
      {steps.map((step, i) => {
        const failed = step.current && stage === "ssl_failed"
        return (
          <li
            key={step.id}
            aria-current={step.current ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-2 sm:flex-1", i < steps.length - 1 && "sm:pr-2")}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition",
                step.done && "bg-emerald-600 text-white",
                step.current && !failed && "bg-violet-600 text-white ring-4 ring-violet-500/20",
                failed && "bg-rose-600 text-white ring-4 ring-rose-500/20",
                !step.done && !step.current && "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              )}
            >
              {step.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "min-w-0 text-xs font-semibold",
                step.done || step.current ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              {labels[step.id]}
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "mx-1 hidden h-px flex-1 sm:block",
                  step.done ? "bg-emerald-500/60" : "bg-zinc-300 dark:bg-zinc-700"
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
