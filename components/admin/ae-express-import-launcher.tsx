"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Link2, Loader2, Rocket, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  buildAeImportBookmarklet,
  isAffisellAeCaptureMessage,
  isAliExpressOrigin,
} from "@/lib/fulfillment/ae-import-bookmarklet"

type CapturePayload = {
  aeUrl: string
  aerData: unknown
}

type Props = {
  productId: string
  aeUrl: string
  disabled?: boolean
  onCapture: (payload: CapturePayload) => void | Promise<void>
}

type Phase = "idle" | "waiting" | "received"

const BOOKMARKLET_INSTALLED_KEY = "affisell.aeImportBookmarklet.v1"

export function AeExpressImportLauncher({ productId, aeUrl, disabled, onCapture }: Props) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [bookmarkletInstalled, setBookmarkletInstalled] = useState(true)

  const appOrigin = useMemo(() => {
    if (typeof window !== "undefined") return window.location.origin
    return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"
  }, [])

  const bookmarkletHref = useMemo(
    () => buildAeImportBookmarklet({ appOrigin, productId }),
    [appOrigin, productId]
  )

  useEffect(() => {
    try {
      setBookmarkletInstalled(localStorage.getItem(BOOKMARKLET_INSTALLED_KEY) === "1")
    } catch {
      setBookmarkletInstalled(false)
    }
  }, [])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAliExpressOrigin(event.origin)) return
      if (!isAffisellAeCaptureMessage(event.data, productId)) return
      setPhase("received")
      void onCapture({ aeUrl: event.data.aeUrl, aerData: event.data.aerData })
      window.setTimeout(() => setPhase("idle"), 2500)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onCapture, productId])

  const markInstalled = useCallback(() => {
    try {
      localStorage.setItem(BOOKMARKLET_INSTALLED_KEY, "1")
    } catch {
      /* ignore */
    }
    setBookmarkletInstalled(true)
  }, [])

  const launchImport = useCallback(() => {
    const url = aeUrl.trim()
    if (!url.includes("aliexpress")) return
    setPhase("waiting")
    window.open(url, "affisellAeImport")
  }, [aeUrl])

  const canLaunch = aeUrl.trim().includes("aliexpress") && !disabled

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-300/60 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700 p-[1px] shadow-lg shadow-violet-500/20">
      <div className="relative rounded-[15px] bg-gradient-to-br from-zinc-950 via-violet-950 to-zinc-950 px-5 py-5">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-3xl"
          aria-hidden
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200/90">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Import Express
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">Catalogue AE en 1 clic</h3>
            <p className="mt-1 max-w-xl text-sm text-violet-100/80">
              Sans API, sans ScrapingBee, sans JSON à copier. Votre navigateur lit la page AliExpress
              et envoie le catalogue directement ici.
            </p>
          </div>
          {phase === "received" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Reçu
            </span>
          ) : phase === "waiting" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              En attente…
            </span>
          ) : null}
        </div>

        <ol className="mt-4 space-y-2 text-sm text-violet-50/90">
          <li className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
              1
            </span>
            <span>
              {bookmarkletInstalled ? (
                <>Favori Affisell déjà installé.</>
              ) : (
                <>
                  Glissez{" "}
                  <a
                    href={bookmarkletHref}
                    onClick={markInstalled}
                    className="font-semibold text-fuchsia-200 underline decoration-fuchsia-300/50 underline-offset-2"
                    title="Glisser vers la barre de favoris"
                  >
                    Affisell Import AE
                  </a>{" "}
                  dans votre barre de favoris (une seule fois).
                </>
              )}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
              2
            </span>
            <span>Lancez l&apos;import — la page AliExpress s&apos;ouvre.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
              3
            </span>
            <span>
              Cliquez le favori <strong>Affisell Import AE</strong> sur la page produit.
            </span>
          </li>
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!canLaunch || phase === "waiting"}
            className="border-0 bg-white text-violet-950 hover:bg-violet-50"
            onClick={launchImport}
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

        {phase === "waiting" ? (
          <p className="mt-3 text-xs text-fuchsia-100/70">
            Onglet AliExpress ouvert — cliquez le favori sur la fiche produit. Cette page se met à
            jour automatiquement.
          </p>
        ) : null}
      </div>
    </div>
  )
}
