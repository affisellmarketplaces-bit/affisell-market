"use client"

import { CheckCircle2, ImageIcon, Loader2, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"

import type { GalleryIssue, PhotoIssue } from "@/lib/photo-quality"
import { cn } from "@/lib/utils"

type ImageReport = {
  url: string
  ok: boolean
  metrics: { width: number; height: number; bytes: number; format: string } | null
  issues: PhotoIssue[]
  betterUrl: string | null
}
type Report = { images: ImageReport[]; gallery: { issues: GalleryIssue[]; score: number } }

type Props = {
  images: string[]
  /** Replace one URL by another (e.g. thumbnail → original resolution). */
  onReplace: (from: string, to: string) => void
}

const isRemote = (u: string) => /^https:\/\//i.test(u.trim())

/**
 * Measured advice on the product photos (size, ratio, compression, main-shot background, duplicates).
 * Advisory only. Runs on remote (https) photos; inline uploads are checked once they have a URL.
 */
export function SupplierPhotoQualityHint({ images, onReplace }: Props) {
  const t = useTranslations("supplierPhotos")
  const remote = useMemo(() => images.filter(isRemote).slice(0, 8), [images])
  const inline = images.length - images.filter(isRemote).length
  const key = remote.join("\n")
  const [report, setReport] = useState<Report | null>(null)
  const [state, setState] = useState<"idle" | "loading" | "error">("idle")
  const seq = useRef(0)

  useEffect(() => {
    if (remote.length === 0) {
      setReport(null)
      setState("idle")
      return
    }
    const mine = ++seq.current
    setState("loading")
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/supplier/photo-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ images: remote }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as Report
        if (mine === seq.current) {
          setReport(data)
          setState("idle")
        }
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError" && mine === seq.current) setState("error")
      }
    }, 900)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // `key` is the stable identity of the remote list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (images.length === 0) return null

  const flagged = report?.images.map((im, i) => ({ im, i })).filter(({ im }) => im.issues.length > 0 || im.betterUrl) ?? []
  const galleryIssues = report?.gallery.issues ?? []
  const clean = report != null && flagged.length === 0 && galleryIssues.length === 0
  const tier = report ? (report.gallery.score >= 80 ? "excellent" : report.gallery.score >= 55 ? "good" : "needsWork") : null

  return (
    <div
      className={cn(
        "mt-3 rounded-xl border p-3 text-xs",
        clean
          ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100"
          : "border-amber-200/80 bg-amber-50/70 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100"
      )}
      role="status"
      aria-live="polite"
    >
      <p className="flex items-center gap-1.5 font-semibold">
        {state === "loading" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : clean ? (
          <CheckCircle2 className="size-3.5" aria-hidden />
        ) : (
          <ImageIcon className="size-3.5" aria-hidden />
        )}
        {state === "loading" && !report ? t("checking") : clean ? t("allGood") : t("heading")}
        {tier ? <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 tabular-nums dark:bg-black/30">{t(`tier.${tier}`)} · {report!.gallery.score}</span> : null}
      </p>

      {state === "error" ? <p className="mt-1">{t("error")}</p> : null}
      {inline > 0 ? <p className="mt-1 opacity-80">{t("inline", { count: inline })}</p> : null}

      {galleryIssues.length > 0 ? (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          {galleryIssues.map((g) => (
            <li key={g}>{t(`gallery.${g}`)}</li>
          ))}
        </ul>
      ) : null}

      {flagged.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {flagged.slice(0, 6).map(({ im, i }) => (
            <li key={im.url} className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="size-10 shrink-0 rounded-md bg-white object-cover ring-1 ring-black/10" loading="lazy" referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {t("photoN", { n: i + 1 })}
                  {im.metrics ? <span className="ml-1 tabular-nums opacity-70">{im.metrics.width}×{im.metrics.height}</span> : null}
                </p>
                <ul className="list-disc pl-4">
                  {im.issues.map((issue) => (
                    <li key={issue} className="flex items-start gap-1">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                      {t(`issue.${issue}`)}
                    </li>
                  ))}
                </ul>
                {im.betterUrl ? (
                  <button
                    type="button"
                    onClick={() => onReplace(im.url, im.betterUrl!)}
                    className="mt-1 inline-flex min-h-8 items-center rounded-lg bg-amber-600 px-2.5 text-xs font-semibold text-white transition hover:bg-amber-500"
                  >
                    {t("useOriginal")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
