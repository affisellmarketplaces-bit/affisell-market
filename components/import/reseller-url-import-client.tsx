"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { buttonVariants } from "@/components/ui/button"
import { detectMarketplaceFromUrl } from "@/lib/import-marketplace"
import {
  AFFILIATE_RESELLER_SIGNUP_HREF,
  affiliateUrlImportSignupHref,
} from "@/lib/affiliate-onboarding-shared"
import { loginAffiliatePath } from "@/lib/login-redirect"
import { cn } from "@/lib/utils"

const PENDING_KEY = "affisell_import_pending_url"

type Preview = {
  title: string
  description: string
  images: string[]
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
}

function money(n: number, currency = "EUR") {
  try {
    return n.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 })
  } catch {
    return `${n.toFixed(2)} €`
  }
}

export function ResellerUrlImportClient() {
  const t = useTranslations("importPage")
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAffiliate = session?.user?.role === "AFFILIATE"

  const [url, setUrl] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [sellPrice, setSellPrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [done, setDone] = useState<{
    shopHref: string
    editHref: string
    isListed: boolean
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
    if (!trimmed) {
      toast.error(t("errEmpty"))
      return
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error(t("errHttps"))
      return
    }
    setLoading(true)
    setDone(null)
    setPreview(null)
    try {
      window.sessionStorage.setItem(PENDING_KEY, trimmed)
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/affiliate/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = (await res.json()) as { error?: string; preview?: Preview }
      if (!res.ok || !data.preview) {
        throw new Error(data.error ?? t("errPreview"))
      }
      setPreview(data.preview)
      setSellPrice(String(data.preview.suggestedPrice))
      toast.success(t("previewOk", { market: data.preview.marketplaceLabel }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errPreview"))
    } finally {
      setLoading(false)
    }
  }, [t, url])

  const commit = useCallback(
    async (listLive: boolean) => {
      if (!preview) return
      if (status === "loading") return

      if (!isAffiliate) {
        try {
          window.sessionStorage.setItem(PENDING_KEY, preview.sourceUrl)
        } catch {
          /* ignore */
        }
        router.push(affiliateUrlImportSignupHref(preview.sourceUrl))
        return
      }

      setCommitting(true)
      try {
        const sell = parseFloat(sellPrice.replace(",", "."))
        const res = await fetch("/api/affiliate/import-url/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            url: preview.sourceUrl,
            sellingPriceEur: Number.isFinite(sell) ? sell : preview.suggestedPrice,
            listLive,
          }),
        })
        const data = (await res.json()) as {
          error?: string
          code?: string
          shopHref?: string
          editHref?: string
          isListed?: boolean
        }
        if (res.status === 401) {
          router.push(loginAffiliatePath(`/import?url=${encodeURIComponent(preview.sourceUrl)}`))
          return
        }
        if (!res.ok) throw new Error(data.error ?? t("errCommit"))
        setDone({
          shopHref: data.shopHref ?? "/shops",
          editHref: data.editHref ?? "/dashboard/affiliate/catalog",
          isListed: data.isListed === true,
        })
        try {
          window.sessionStorage.removeItem(PENDING_KEY)
        } catch {
          /* ignore */
        }
        toast.success(listLive ? t("commitLiveOk") : t("commitDraftOk"))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("errCommit"))
      } finally {
        setCommitting(false)
      }
    },
    [isAffiliate, preview, router, sellPrice, status, t]
  )

  useEffect(() => {
    const auto = searchParams.get("auto") === "1"
    const q = searchParams.get("url")?.trim()
    if (!auto || !q || loading || preview) return
    void runPreview()
  }, [searchParams, loading, preview, runPreview])

  return (
    <div className="mx-auto w-full max-w-3xl">
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
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("urlPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              inputMode="url"
              autoComplete="url"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
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
        {market ? (
          <p className="mt-2 px-1 text-[11px] text-violet-200/80">
            {t("detected", { market: market.label })}
          </p>
        ) : null}
      </form>

      {preview ? (
        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/12 bg-zinc-950/70 shadow-xl backdrop-blur-xl">
          <div className="grid gap-4 p-4 sm:grid-cols-[7.5rem_1fr] sm:p-5">
            <div className="relative mx-auto aspect-square w-28 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10 sm:mx-0 sm:w-full">
              {preview.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.images[0]}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-zinc-600">
                  <Store className="size-8" aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">
                {preview.marketplaceLabel} · {preview.brand}
              </p>
              <h2 className="mt-1 text-lg font-bold leading-snug text-white">{preview.title}</h2>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-white/5 px-3 py-1 text-zinc-300">
                  {t("cost")}: {money(preview.costPrice, preview.currency)}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-200">
                  {t("profit")}: {money(preview.profitPerSale, preview.currency)}
                </span>
              </div>
              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {t("sellPrice")}
                <input
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
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
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-zinc-400">
              <Sparkles className="size-3.5 text-violet-300" aria-hidden />
              {isAffiliate ? t("readyAffiliate") : t("readyGuest")}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={committing}
                onClick={() => void commit(false)}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "rounded-full border-white/25 bg-transparent text-white hover:bg-white/10"
                )}
              >
                {committing ? <Loader2 className="size-4 animate-spin" /> : null}
                {isAffiliate ? t("saveDraft") : t("signupDraft")}
              </button>
              <button
                type="button"
                disabled={committing}
                onClick={() => void commit(true)}
                className={cn(
                  buttonVariants(),
                  "rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                )}
              >
                {isAffiliate ? t("publishLive") : t("signupLive")}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {done ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
          <div className="min-w-0 space-y-2">
            <p className="font-semibold">{done.isListed ? t("doneLive") : t("doneDraft")}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={done.shopHref}
                className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
              >
                {t("viewShop")}
              </Link>
              <Link
                href={done.editHref}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "rounded-full border-white/25 bg-transparent text-white"
                )}
              >
                {t("editListing")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {!isAffiliate && status !== "loading" ? (
        <p className="mt-4 text-center text-xs text-violet-200/70">
          {t("alreadyAccount")}{" "}
          <Link
            href={loginAffiliatePath(
              `/import${url.trim() ? `?url=${encodeURIComponent(url.trim())}` : ""}`
            )}
            className="font-semibold text-white underline underline-offset-2"
          >
            {t("loginLink")}
          </Link>
          {" · "}
          <Link href={AFFILIATE_RESELLER_SIGNUP_HREF} className="underline underline-offset-2">
            {t("signupLink")}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
