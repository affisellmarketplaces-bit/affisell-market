"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Search } from "lucide-react"
import { useTranslations } from "next-intl"

import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TrackCarrier = {
  id: string
  name: string
  type: string
  delivery_min: number
  delivery_max: number
  reliability: number
  logo: string
  color: string
  tracking_url: string
  website: string
}

type TrackResponse = {
  tracking: string
  detectedCarrier: TrackCarrier | null
  isValidFormat: boolean
  crackingScore: number
  isFake: boolean
  realStatus: string | null
  mode: "live" | "mock"
  links: {
    official: string
    google: string
    carrier: string | null
  }
  error?: string
}

export function TrackingVerifier({ className }: { className?: string }) {
  const t = useTranslations("shipping")
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TrackResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verify = useCallback(async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setError("missing_code")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/shipping/track?code=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      })
      const data = (await res.json()) as TrackResponse
      if (!res.ok) {
        setError(data.error ?? "track_failed")
        setResult(null)
        return
      }
      setResult(data)
      console.log("[shipping-track-ui]", {
        tracking: data.tracking,
        isFake: data.isFake,
        carrier: data.detectedCarrier?.id ?? null,
      })
    } catch {
      setError("network")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const q = searchParams.get("code")?.trim()
    if (!q) return
    setCode(q)
    void verify(q)
  }, [searchParams, verify])

  const carrierTrackHref =
    result?.links.carrier ??
    (result?.detectedCarrier
      ? result.detectedCarrier.tracking_url.replaceAll(
          "{tracking}",
          encodeURIComponent(result.tracking)
        )
      : null)

  return (
    <div className={cn("space-y-6", className)}>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          void verify(code)
        }}
      >
        <label className="sr-only" htmlFor="tracking-code">
          {t("verify")}
        </label>
        <input
          id="tracking-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="1Z999AA10123456784"
          className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm tracking-tight text-zinc-900 shadow-sm outline-none ring-violet-500/30 placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={loading}
          className={cn(
            buttonVariants({ size: "lg" }),
            "gap-2 rounded-2xl bg-zinc-900 px-5 font-semibold text-white hover:bg-black dark:bg-white dark:text-zinc-900"
          )}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
          {t("verify")}
        </button>
      </form>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3",
              result.isFake
                ? "border-red-300 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-50"
                : "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-50"
            )}
          >
            {result.isFake ? (
              <AlertTriangle className="size-5 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 className="size-5 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tracking-tight">
                {result.isFake ? `🚨 ${t("fakeAlert")}` : `✅ ${t("verifyValid")}`}
              </p>
              <p className="text-xs opacity-80">
                {t("crackingScore", { score: result.crackingScore })} · {result.tracking}
              </p>
            </div>
            <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide dark:bg-white/10">
              {result.realStatus ?? "—"}
            </span>
          </div>

          {result.detectedCarrier ? (
            <div
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              style={{ borderTopColor: result.detectedCarrier.color, borderTopWidth: 3 }}
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.detectedCarrier.logo}
                  alt=""
                  className="h-8 w-12 object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {result.detectedCarrier.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {result.detectedCarrier.delivery_min}–{result.detectedCarrier.delivery_max}{" "}
                    {t("etaUnit")} · {t("reliability")} {result.detectedCarrier.reliability}%
                  </p>
                </div>
              </div>
              {carrierTrackHref ? (
                <a
                  href={carrierTrackHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-3 w-full gap-2 rounded-xl"
                  )}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  {t("officialTrack")}
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={result.links.official}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "gap-2 rounded-xl"
              )}
            >
              ParcelsApp
            </a>
            <a
              href={result.links.google}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "gap-2 rounded-xl"
              )}
            >
              Google Tracking
            </a>
          </div>
        </div>
      ) : null}

      <p className="text-center text-[11px] leading-relaxed text-zinc-400">
        {result?.mode === "mock" || !result ? t("mockModeHint") : t("liveModeHint")}
        {" · "}
        SIRET {AFFISELL_LEGAL_IDENTITY.siret}
        {" · "}
        <Link href="/shipping" className="underline-offset-2 hover:underline">
          {t("carriersTitle")}
        </Link>
      </p>
    </div>
  )
}
