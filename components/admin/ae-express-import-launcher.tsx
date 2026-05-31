"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Link2, Loader2, Rocket, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  buildAeImportBookmarklet,
  isAffisellAeCaptureMessage,
  isAliExpressOrigin,
} from "@/lib/fulfillment/ae-import-bookmarklet"

export type AeCaptureResult = {
  resolved: {
    aeProductId: string
    aeSkuId: string | null
    aeShopId: string
    aePriceCents: number
    aeShippingCents: number
    aeUrl: string
    aeSkus: import("@/lib/fulfillment/ae-product-skus").AeProductSkuRow[]
    source?: string
  }
  suggestions: {
    productVariantId: string
    aeSkuId: string
    matchColor: string | null
    aePriceCents: number
    aeLabel: string
  }[]
}

type Props = {
  productId: string
  aeUrl: string
  disabled?: boolean
  onCapture: (result: AeCaptureResult) => void
}

type Phase = "idle" | "waiting" | "received"

const BOOKMARKLET_INSTALLED_KEY = "affisell.aeImportBookmarklet.v2"
const POLL_MS = 350
const POLL_MAX = 90

function isCaptureDoneMessage(
  data: unknown,
  productId: string
): data is { type: "AFFISELL_AE_CAPTURE_DONE"; productId: string; resolved: AeCaptureResult["resolved"]; suggestions: AeCaptureResult["suggestions"] } {
  if (!data || typeof data !== "object") return false
  const rec = data as Record<string, unknown>
  return rec.type === "AFFISELL_AE_CAPTURE_DONE" && rec.productId === productId && Boolean(rec.resolved)
}

export function AeExpressImportLauncher({ productId, aeUrl, disabled, onCapture }: Props) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [bookmarkletInstalled, setBookmarkletInstalled] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const sessionRef = useRef<string | null>(null)

  const appOrigin = useMemo(() => {
    if (typeof window !== "undefined") return window.location.origin
    return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"
  }, [])

  const bookmarkletHref = useMemo(
    () => buildAeImportBookmarklet({ appOrigin, productId }),
    [appOrigin, productId]
  )

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const finishCapture = useCallback(
    (result: AeCaptureResult) => {
      stopPolling()
      setPhase("received")
      onCapture(result)
      setHint(null)
      window.setTimeout(() => setPhase("idle"), 2000)
    },
    [onCapture, stopPolling]
  )

  const startPolling = useCallback(
    (sessionId: string) => {
      stopPolling()
      let attempts = 0
      pollRef.current = window.setInterval(() => {
        attempts += 1
        if (attempts > POLL_MAX) {
          stopPolling()
          setPhase("idle")
          setHint("Délai dépassé — recliquez le favori sur la page AliExpress.")
          return
        }
        void fetch(
          `/api/admin/products/${productId}/ae-capture/poll?sessionId=${encodeURIComponent(sessionId)}`,
          { credentials: "include" }
        )
          .then((r) => r.json())
          .then((data: { ready?: boolean; resolved?: AeCaptureResult["resolved"]; suggestions?: AeCaptureResult["suggestions"] }) => {
            if (!data.ready || !data.resolved) return
            finishCapture({
              resolved: data.resolved,
              suggestions: data.suggestions ?? [],
            })
          })
          .catch(() => {})
      }, POLL_MS)
    },
    [finishCapture, productId, stopPolling]
  )

  useEffect(() => {
    try {
      setBookmarkletInstalled(localStorage.getItem(BOOKMARKLET_INSTALLED_KEY) === "1")
    } catch {
      setBookmarkletInstalled(false)
    }
    return () => stopPolling()
  }, [stopPolling])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (isCaptureDoneMessage(event.data, productId) && event.origin === appOrigin) {
        finishCapture({
          resolved: event.data.resolved,
          suggestions: event.data.suggestions ?? [],
        })
        return
      }
      if (!isAliExpressOrigin(event.origin)) return
      if (!isAffisellAeCaptureMessage(event.data, productId)) return
      setHint("Données reçues — finalisation…")
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [appOrigin, finishCapture, productId])

  const markInstalled = useCallback(() => {
    try {
      localStorage.setItem(BOOKMARKLET_INSTALLED_KEY, "1")
    } catch {
      /* ignore */
    }
    setBookmarkletInstalled(true)
  }, [])

  const launchImport = useCallback(async () => {
    const url = aeUrl.trim()
    if (!url.includes("aliexpress")) return
    setPhase("waiting")
    setHint("Ouverture du pont Affisell…")

    try {
      const res = await fetch(`/api/admin/products/${productId}/ae-capture/session`, {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as {
        sessionId?: string
        captureToken?: string
        error?: string
      }
      if (!res.ok || !data.sessionId || !data.captureToken) {
        setPhase("idle")
        setHint(data.error ?? "Session import impossible")
        return
      }
      sessionRef.current = data.sessionId
      startPolling(data.sessionId)

      const relayUrl = `/admin/products/${productId}/import-relay?${new URLSearchParams({
        aeUrl: url,
        sessionId: data.sessionId,
        captureToken: data.captureToken,
      }).toString()}`

      window.open(
        relayUrl,
        "affisellAeRelay",
        "popup=yes,width=440,height=420,left=80,top=80"
      )
      setHint("Cliquez le favori Affisell Import AE sur la page AliExpress.")
    } catch {
      setPhase("idle")
      setHint("Erreur réseau — réessayez.")
    }
  }, [aeUrl, productId, startPolling])

  const canLaunch = aeUrl.trim().includes("aliexpress") && !disabled

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-300/60 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700 p-[1px] shadow-lg shadow-violet-500/20">
      <div className="relative rounded-[15px] bg-gradient-to-br from-zinc-950 via-violet-950 to-zinc-950 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200/90">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Import Express
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">Catalogue AE en 1 clic</h3>
            <p className="mt-1 max-w-xl text-sm text-violet-100/80">
              Pont sécurisé Affisell ↔ AliExpress. Aucun JSON, aucune API officielle.
            </p>
          </div>
          {phase === "received" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Importé
            </span>
          ) : phase === "waiting" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              En cours…
            </span>
          ) : null}
        </div>

        {!bookmarkletInstalled ? (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <strong>Important :</strong> réinstallez le favori{" "}
            <a href={bookmarkletHref} onClick={markInstalled} className="font-semibold underline">
              Affisell Import AE
            </a>{" "}
            (glisser dans la barre de favoris) — version mise à jour requise.
          </div>
        ) : null}

        <ol className="mt-4 space-y-2 text-sm text-violet-50/90">
          <li className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
              1
            </span>
            <span>Cliquez <strong>Lancer import express</strong> — le pont s&apos;ouvre.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
              2
            </span>
            <span>Sur AliExpress, cliquez le favori <strong>Affisell Import AE</strong>.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
              3
            </span>
            <span>Les champs se remplissent ici automatiquement.</span>
          </li>
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!canLaunch || phase === "waiting"}
            className="border-0 bg-white text-violet-950 hover:bg-violet-50"
            onClick={() => void launchImport()}
          >
            <Rocket className="mr-2 h-4 w-4" aria-hidden />
            Lancer import express
          </Button>
          {!bookmarkletInstalled ? (
            <a
              href={bookmarkletHref}
              onClick={markInstalled}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Installer le favori
            </a>
          ) : null}
        </div>

        {hint ? <p className="mt-3 text-xs text-fuchsia-100/80">{hint}</p> : null}
      </div>
    </div>
  )
}
