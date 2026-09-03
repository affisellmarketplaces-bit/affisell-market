"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Loader2,
  Sparkles,
  Store,
  Zap,
} from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import { toast } from "sonner"

import { DropForgeAeBrowserBridge } from "@/components/import/dropforge-ae-browser-bridge"
import { DropForgeRefinePanel } from "@/components/import/dropforge-refine-panel"
import { buttonVariants } from "@/components/ui/button"
import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import { validateDropForgeProductUrl } from "@/lib/dropforge-product-url"
import {
  DROPFORGE_CATALOG_RESELLER_HREF,
  DROPFORGE_HREF,
  SUPPLIER_SIGNUP_HREF,
  dropforgeSupplierSignupHref,
  type DropForgeCommitIntent,
} from "@/lib/affiliate-onboarding-shared"
import {
  clearDropForgePendingCommit,
  DROPFORGE_PENDING_URL_KEY,
  loadDropForgePendingCommit,
  parseDropForgeCommitIntent,
  saveDropForgePendingCommit,
} from "@/lib/dropforge-pending-commit.shared"
import { loginSupplierPath } from "@/lib/login-redirect"
import { cn } from "@/lib/utils"

const PENDING_KEY = DROPFORGE_PENDING_URL_KEY

/** Prefer AliExpress / 1688 — primary B2B sourcing paths. */
const EXAMPLE_URLS = [
  {
    label: "AliExpress",
    url: "https://www.aliexpress.com/item/1005008719608144.html",
  },
  {
    label: "Amazon",
    url: "https://www.amazon.fr/dp/B09V3KXJPB",
  },
  {
    label: "Temu",
    url: "https://www.temu.com/fr-fr/g-601099512345678.html",
  },
] as const

type Preview = {
  title: string
  description: string
  images: string[]
  videos?: string[]
  variants?: Array<{ name: string }>
  colors?: Array<{ name: string }>
  sizes?: string[]
  specs?: Record<string, string>
  costPrice: number
  suggestedPrice: number
  profitPerSale: number
  currency: string
  brand: string
  category: string
  platform: string
  marketplaceLabel: string
  method: string
  sourceUrl: string
  warnings: string[]
  partial?: boolean
  catalogProductId?: string
  fulfillmentReady?: boolean
  fulfillmentReason?: "aliexpress" | "catalog_link" | "manual_supplier" | "pending_ops"
  aliexpressProductId?: string | null
}

function money(n: number, currency = "EUR") {
  try {
    return n.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 })
  } catch {
    return `${n.toFixed(2)} €`
  }
}

function defaultWholesaleEur(cost: number): number {
  return Math.max(cost + 0.5, Number((cost * 1.25).toFixed(2)))
}

function isSupplierPublishable(p: Preview): boolean {
  return (
    p.title.trim().length >= 3 &&
    p.images.length >= 1 &&
    p.costPrice > 0 &&
    p.fulfillmentReady === true
  )
}

function fulfillmentStatusMessage(p: Preview, t: (key: string) => string): string {
  if (p.fulfillmentReason === "aliexpress" || p.fulfillmentReason === "catalog_link") {
    return t("fulfillmentReady")
  }
  if (p.fulfillmentReason === "manual_supplier") {
    return t("fulfillmentManualSupplier")
  }
  return t("fulfillmentPending")
}

function fulfillmentStatusTone(p: Preview): string {
  if (p.fulfillmentReason === "manual_supplier") {
    return "border-sky-400/35 bg-sky-500/10 text-sky-100"
  }
  if (p.fulfillmentReady) {
    return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
  }
  return "border-rose-400/40 bg-rose-500/10 text-rose-50"
}

/** DropForge B2B — suppliers forge catalog SKUs; resellers relist later. */
export function DropForgeImportClient() {
  const t = useTranslations("importPage")
  const locale = useLocale() === "en" ? "en" : "fr"
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const role = session?.user?.role
  const isSupplier = role === "SUPPLIER" || role === "ADMIN"
  const isAffiliate = role === "AFFILIATE"

  const [url, setUrl] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [wholesalePrice, setWholesalePrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [oauthReconnectUrl, setOauthReconnectUrl] = useState<string | null>(null)
  const [showBrowserBridge, setShowBrowserBridge] = useState(false)
  const [bridgeBusy, setBridgeBusy] = useState(false)
  const [guestRedirecting, setGuestRedirecting] = useState<DropForgeCommitIntent | null>(null)
  const autoCommitStarted = useRef(false)
  const [done, setDone] = useState<{
    catalogHref: string
    editHref: string
    isPublished: boolean
  } | null>(null)

  const market = useMemo(() => (url.trim() ? detectMarketplaceFromUrl(url) : null), [url])

  useEffect(() => {
    const fromQuery = searchParams.get("url")?.trim()
    if (fromQuery) {
      setUrl(fromQuery)
      return
    }
    try {
      const pending = window.sessionStorage.getItem(PENDING_KEY)
      if (pending) setUrl(pending)
    } catch {
      /* ignore */
    }
  }, [searchParams])

  const runPreview = useCallback(async () => {
    const trimmed = url.trim()
    const validated = validateDropForgeProductUrl(trimmed)
    if (!validated.ok) {
      const msg =
        validated.code === "empty"
          ? t("errEmpty")
          : validated.code === "https"
            ? t("errHttps")
            : validated.code === "homepage"
              ? t("errProductUrl")
              : validated.error
      setScanError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    setDone(null)
    setPreview(null)
    setScanError(null)
    setOauthReconnectUrl(null)
    setShowBrowserBridge(false)
    try {
      window.sessionStorage.setItem(PENDING_KEY, validated.url)
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/dropforge/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: validated.url }),
      })
      const data = (await res.json()) as {
        error?: string
        preview?: Preview
        useBrowserCapture?: boolean
        oauthReconnectUrl?: string | null
      }
      if (!res.ok || !data.preview) {
        setOauthReconnectUrl(data.oauthReconnectUrl ?? null)
        if (data.useBrowserCapture && validated.url.includes("aliexpress")) {
          setShowBrowserBridge(true)
        }
        throw new Error(data.error ?? t("errPreview"))
      }
      setOauthReconnectUrl(null)
      setPreview(data.preview)
      setWholesalePrice(String(defaultWholesaleEur(data.preview.costPrice)))
      if (validated.url !== trimmed) {
        setUrl(validated.url)
        toast.message(t("urlNormalized"), { description: validated.url })
      }
      toast.success(
        data.preview.partial
          ? t("previewPartial", { market: data.preview.marketplaceLabel })
          : t("previewOk", { market: data.preview.marketplaceLabel })
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("errPreview")
      setScanError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [t, url])

  const applyBridgePreview = useCallback(
    (raw: Record<string, unknown>) => {
      const p = raw as unknown as Preview
      if (!p.title || !p.sourceUrl) {
        toast.error(t("errPreview"))
        return
      }
      setPreview(p)
      setWholesalePrice(String(defaultWholesaleEur(p.costPrice)))
      setScanError(null)
      setShowBrowserBridge(false)
      toast.success(t("previewOk", { market: p.marketplaceLabel ?? "AliExpress" }))
    },
    [t]
  )

  const applyRefinedPreview = useCallback(
    (raw: Record<string, unknown>, meta?: { applied?: string[] }) => {
      const p = raw as unknown as Preview
      if (!p.title || !p.sourceUrl) return
      setPreview(p)
      saveDropForgePendingCommit({
        sourceUrl: p.sourceUrl,
        preview: raw,
        wholesalePrice,
        publishLive: false,
      })
      if (meta?.applied?.length) {
        toast.success(t("refineOk", { count: meta.applied.length }))
      }
    },
    [t, wholesalePrice]
  )

  const commit = useCallback(
    async (publishLive: boolean) => {
      if (!preview) return
      if (status === "loading") return

      if (!isSupplier) {
        const intent: DropForgeCommitIntent = publishLive ? "live" : "draft"
        setGuestRedirecting(intent)
        saveDropForgePendingCommit({
          sourceUrl: preview.sourceUrl,
          preview: preview as unknown as Record<string, unknown>,
          wholesalePrice,
          publishLive,
        })
        router.push(dropforgeSupplierSignupHref(preview.sourceUrl, { commit: intent }))
        return
      }

      const canPublish =
        isSupplier && isSupplierPublishable(preview) && publishLive === true

      setCommitting(true)
      try {
        const wholesale = parseFloat(wholesalePrice.replace(",", "."))
        const res = await fetch("/api/dropforge/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            url: preview.sourceUrl,
            wholesalePriceEur: Number.isFinite(wholesale)
              ? wholesale
              : defaultWholesaleEur(preview.costPrice),
            titleOverride: preview.title,
            publishLive: canPublish,
            snapshot: preview,
          }),
        })
        const data = (await res.json()) as {
          error?: string
          code?: string
          catalogHref?: string
          editHref?: string
          isPublished?: boolean
        }
        if (res.status === 401) {
          const intent: DropForgeCommitIntent = publishLive ? "live" : "draft"
          saveDropForgePendingCommit({
            sourceUrl: preview.sourceUrl,
            preview: preview as unknown as Record<string, unknown>,
            wholesalePrice,
            publishLive,
          })
          router.push(
            loginSupplierPath(
              `${DROPFORGE_HREF}?url=${encodeURIComponent(preview.sourceUrl)}&auto=1&commit=${intent}`
            )
          )
          return
        }
        if (!res.ok) throw new Error(data.error ?? t("errCommit"))
        setDone({
          catalogHref: data.catalogHref ?? "/dashboard/supplier/products",
          editHref: data.editHref ?? "/dashboard/supplier/products",
          isPublished: data.isPublished === true,
        })
        clearDropForgePendingCommit()
        try {
          window.sessionStorage.removeItem(PENDING_KEY)
        } catch {
          /* ignore */
        }
        toast.success(data.isPublished ? t("commitLiveOk") : t("commitDraftOk"))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("errCommit"))
      } finally {
        setCommitting(false)
        setGuestRedirecting(null)
      }
    },
    [isSupplier, preview, router, wholesalePrice, status, t]
  )

  useEffect(() => {
    const auto = searchParams.get("auto") === "1"
    const q = searchParams.get("url")?.trim()
    if (!auto || loading || preview) return

    const pending = loadDropForgePendingCommit()
    if (pending?.sourceUrl) {
      setUrl(pending.sourceUrl)
      setPreview(pending.preview as unknown as Preview)
      setWholesalePrice(String(pending.wholesalePriceEur))
      return
    }

    if (!q) return
    void runPreview()
  }, [searchParams, loading, preview, runPreview])

  useEffect(() => {
    const commitIntent = parseDropForgeCommitIntent(searchParams.get("commit"))
    if (!commitIntent || status === "loading" || !isSupplier || !preview || done) return
    if (autoCommitStarted.current || committing) return
    autoCommitStarted.current = true
    toast.message(
      commitIntent === "live" ? t("autoCommitLive") : t("autoCommitDraft"),
      { description: preview.title.slice(0, 80) }
    )
    void commit(commitIntent === "live")
  }, [commit, committing, done, isSupplier, preview, searchParams, status, t])

  return (
    <div className="mx-auto w-full max-w-3xl">
      {isAffiliate ? (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-50"
          data-testid="dropforge-reseller-redirect"
        >
          <p className="font-semibold">{t("resellerNoticeTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/90">{t("resellerNoticeBody")}</p>
          <Link
            href={DROPFORGE_CATALOG_RESELLER_HREF}
            className={cn(
              buttonVariants({ size: "sm" }),
              "mt-3 rounded-full bg-white/10 text-white hover:bg-white/20"
            )}
          >
            {t("resellerCatalogCta")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      <form
        className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/10 p-3 shadow-2xl shadow-violet-950/40 backdrop-blur-xl sm:p-4"
        onSubmit={(e) => {
          e.preventDefault()
          void runPreview()
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-fuchsia-500/25 blur-3xl"
          aria-hidden
        />
        <label htmlFor="import-url" className="sr-only">
          {t("urlLabel")}
        </label>
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/15 bg-black/35 px-3 py-2.5">
            <Link2 className="size-4 shrink-0 text-violet-300" aria-hidden />
            <input
              id="import-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setScanError(null)
              }}
              placeholder={t("urlPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              inputMode="url"
              autoComplete="url"
            />
          </div>
          <button
            type="submit"
            disabled={loading || bridgeBusy}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 shrink-0 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 font-semibold text-white shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-fuchsia-500"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("scanning")}
              </>
            ) : (
              <>
                <Zap className="size-4" aria-hidden />
                {t("scanCta")}
              </>
            )}
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-zinc-500">{t("urlHint")}</p>
        {market ? (
          <p className="mt-1 px-1 text-[11px] text-violet-200/80">
            {t("detected", { market: market.label })}
          </p>
        ) : null}
      </form>

      {scanError ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-50"
        >
          {scanError}
          {oauthReconnectUrl ? (
            <p className="mt-3">
              <a
                href={oauthReconnectUrl}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "inline-flex rounded-full bg-violet-600 hover:bg-violet-500"
                )}
              >
                Reconnecter AliExpress OAuth
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {showBrowserBridge && url.trim().includes("aliexpress") ? (
        <DropForgeAeBrowserBridge
          aeUrl={url.trim()}
          onPreview={applyBridgePreview}
          onBusyChange={setBridgeBusy}
          autoStart={!oauthReconnectUrl}
        />
      ) : null}

      {bridgeBusy ? (
        <p className="mt-2 text-center text-xs text-violet-200/80">{t("bridgeBusy")}</p>
      ) : null}

      {preview ? (
        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/12 bg-zinc-950/70 shadow-xl backdrop-blur-xl">
          <div className="grid gap-4 p-4 sm:grid-cols-[7.5rem_1fr] sm:p-5">
            <div className="relative mx-auto aspect-square w-28 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10 sm:mx-0 sm:w-full">
              {preview.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.images[0]} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-zinc-500">
                  <Store className="size-8" aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">
                {preview.marketplaceLabel}
                {preview.brand ? ` · ${preview.brand}` : ""}
                {preview.partial ? ` · ${t("partialBadge")}` : ""}
              </p>
              <input
                value={preview.title}
                onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-transparent bg-transparent text-lg font-bold leading-snug text-white outline-none focus:border-white/15 focus:bg-black/20 focus:px-2"
              />
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-white/5 px-3 py-1 text-zinc-300">
                  {t("cost")}: {money(preview.costPrice, preview.currency)}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-200">
                  {t("wholesaleHint")}: {money(defaultWholesaleEur(preview.costPrice), preview.currency)}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-zinc-300">
                  {t("mediaCount", {
                    images: preview.images.length,
                    videos: preview.videos?.length ?? 0,
                  })}
                </span>
                <span className="rounded-full bg-violet-500/15 px-3 py-1 text-violet-100">
                  {t("attrsCount", {
                    variants: preview.variants?.length ?? 0,
                    colors: preview.colors?.length ?? 0,
                    specs: Object.keys(preview.specs ?? {}).length,
                  })}
                </span>
              </div>
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {t("wholesalePrice")}
                <input
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                  className="mt-1.5 w-full max-w-[12rem] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-base font-semibold text-white outline-none focus:border-violet-400/50"
                  inputMode="decimal"
                />
              </label>
              {preview.warnings.length > 0 ? (
                <ul className="mt-3 space-y-1 text-[11px] text-amber-200/90">
                  {preview.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : null}

              <div
                className={cn(
                  "mt-4 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
                  fulfillmentStatusTone(preview)
                )}
                data-testid="dropforge-fulfillment-status"
              >
                {fulfillmentStatusMessage(preview, t)}
              </div>

              <DropForgeRefinePanel
                preview={preview as unknown as Record<string, unknown>}
                onPreviewUpdate={applyRefinedPreview}
                locale={locale}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-zinc-400">
              <Sparkles className="size-3.5 text-violet-300" aria-hidden />
              {isSupplier
                ? preview.partial
                  ? preview.fulfillmentReady
                    ? t("readyPartialSupplier")
                    : t("readyPartial")
                  : preview.fulfillmentReason === "manual_supplier"
                    ? t("readyManualSupplier")
                    : preview.fulfillmentReady
                      ? t("readySupplier")
                      : t("readyNoFulfillment")
                : guestRedirecting
                  ? guestRedirecting === "live"
                    ? t("guestRedirectLive")
                    : t("guestRedirectDraft")
                  : t("readyGuest")}
            </p>
            {isAffiliate ? (
              <Link
                href={dropforgeSupplierSignupHref(preview.sourceUrl, { commit: "live" })}
                onClick={() => {
                  saveDropForgePendingCommit({
                    sourceUrl: preview.sourceUrl,
                    preview: preview as unknown as Record<string, unknown>,
                    wholesalePrice,
                    publishLive: true,
                  })
                }}
                className={cn(
                  buttonVariants(),
                  "rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                )}
              >
                {t("affiliateBecomeSupplier")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={committing || Boolean(guestRedirecting)}
                onClick={() => void commit(false)}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "rounded-full border-white/25 bg-transparent text-white transition hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                )}
              >
                {committing || guestRedirecting === "draft" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {isSupplier ? t("saveDraft") : t("signupDraft")}
              </button>
              <button
                type="button"
                disabled={
                  committing ||
                  Boolean(guestRedirecting) ||
                  (isSupplier && !isSupplierPublishable(preview))
                }
                onClick={() => void commit(true)}
                className={cn(
                  buttonVariants(),
                  "rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-fuchsia-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                )}
                title={
                  isSupplier && !isSupplierPublishable(preview)
                    ? preview.fulfillmentReady !== true
                      ? t("publishNeedsFulfillment")
                      : t("publishNeedsComplete")
                    : undefined
                }
              >
                {committing || guestRedirecting === "live" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {isSupplier ? t("publishLive") : t("signupLive")}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center sm:px-6">
          <p className="text-sm font-semibold text-white">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-zinc-400">
            {t("emptyBody")}
          </p>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {t("tryExamples")}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {EXAMPLE_URLS.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setUrl(ex.url)
                  setScanError(null)
                }}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200 transition hover:border-violet-400/40 hover:bg-violet-500/15"
              >
                {ex.label}
              </button>
            ))}
          </div>
          {!isSupplier && !isAffiliate ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={dropforgeSupplierSignupHref(url.trim() || null)}
                className={cn(
                  buttonVariants(),
                  "rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                )}
              >
                {t("signupLive")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={loginSupplierPath(
                  `${DROPFORGE_HREF}${url.trim() ? `?url=${encodeURIComponent(url.trim())}` : ""}`
                )}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "rounded-full border-white/25 bg-transparent text-white hover:bg-white/10"
                )}
              >
                {t("loginLink")}
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {done ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
          <div className="min-w-0 space-y-2">
            <p className="font-semibold">{done.isPublished ? t("doneLive") : t("doneDraft")}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={done.editHref}
                className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
              >
                {t("editListing")}
              </Link>
              <Link
                href={done.catalogHref}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "rounded-full border-white/25 bg-transparent text-white"
                )}
              >
                {t("viewCatalog")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {!isSupplier && !isAffiliate && status !== "loading" ? (
        <p className="mt-4 text-center text-xs text-violet-200/70">
          {t("alreadyAccount")}{" "}
          <Link
            href={loginSupplierPath(
              `${DROPFORGE_HREF}${url.trim() ? `?url=${encodeURIComponent(url.trim())}` : ""}`
            )}
            className="font-semibold text-white underline underline-offset-2"
          >
            {t("loginLink")}
          </Link>
          {" · "}
          <Link href={SUPPLIER_SIGNUP_HREF} className="underline underline-offset-2">
            {t("signupLink")}
          </Link>
        </p>
      ) : null}
    </div>
  )
}

/** @deprecated Use DropForgeImportClient — kept for import path stability. */
export const ResellerUrlImportClient = DropForgeImportClient
