"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  MousePointerClick,
  Rocket,
  Sparkles,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  appendAeCaptureContextToUrl,
  buildSessionAeImportBookmarklet,
  buildUniversalAeImportBookmarklet,
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

const BOOKMARKLET_INSTALLED_KEY = "affisell.aeImportBookmarklet.v4"
const POLL_MS = 500
const POLL_MAX = 240

function isCaptureDoneMessage(
  data: unknown,
  productId: string
): data is {
  type: "AFFISELL_AE_CAPTURE_DONE"
  productId: string
  resolved: AeCaptureResult["resolved"]
  suggestions: AeCaptureResult["suggestions"]
} {
  if (!data || typeof data !== "object") return false
  const rec = data as Record<string, unknown>
  return rec.type === "AFFISELL_AE_CAPTURE_DONE" && rec.productId === productId && Boolean(rec.resolved)
}

export function AeExpressImportLauncher({ productId, aeUrl, disabled, onCapture }: Props) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [bookmarkletInstalled, setBookmarkletInstalled] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [sessionCapture, setSessionCapture] = useState<{
    sessionId: string
    captureToken: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<number | null>(null)

  const appOrigin = useMemo(() => {
    if (typeof window !== "undefined") return window.location.origin
    return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com"
  }, [])

  const universalBookmarkletHref = useMemo(
    () => buildUniversalAeImportBookmarklet(appOrigin),
    [appOrigin]
  )

  const sessionBookmarkletHref = useMemo(() => {
    if (!sessionCapture) return null
    return buildSessionAeImportBookmarklet(
      appOrigin,
      productId,
      sessionCapture.sessionId,
      sessionCapture.captureToken
    )
  }, [appOrigin, productId, sessionCapture])

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
      setSessionCapture(null)
      onCapture(result)
      setHint(null)
      window.setTimeout(() => setPhase("idle"), 2500)
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
          setHint(
            "Délai dépassé. Sur AliExpress : favori « Affisell Import AE » ou le lien session ci-dessous."
          )
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

  const copySessionLink = useCallback(async () => {
    if (!sessionBookmarkletHref) return
    try {
      await navigator.clipboard.writeText(sessionBookmarkletHref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setHint("Copiez le lien session manuellement (bouton ci-dessous).")
    }
  }, [sessionBookmarkletHref])

  const launchImport = useCallback(async () => {
    const url = aeUrl.trim()
    if (!url.includes("aliexpress")) return
    setPhase("waiting")
    setHint("Ouverture du pont quantique Affisell ↔ AliExpress…")

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

      setSessionCapture({ sessionId: data.sessionId, captureToken: data.captureToken })
      startPolling(data.sessionId)

      const relayUrl = `/admin/products/${productId}/import-relay?${new URLSearchParams({
        aeUrl: url,
        sessionId: data.sessionId,
        captureToken: data.captureToken,
      }).toString()}`

      window.open(
        relayUrl,
        "affisellAeRelay",
        "popup=yes,width=480,height=520,left=80,top=80"
      )
      setHint(
        "Étape 2 : sur la page AliExpress ouverte, cliquez le favori Affisell Import AE (ou le lien session violet)."
      )
    } catch {
      setPhase("idle")
      setHint("Erreur réseau — réessayez.")
    }
  }, [aeUrl, productId, startPolling])

  const canLaunch = aeUrl.trim().includes("aliexpress") && !disabled

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 shadow-2xl shadow-violet-950/40">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.45), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(6,182,212,0.25), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]"
        aria-hidden
      />

      <div className="relative border-b border-white/10 bg-black/40 px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/90">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Neural Bridge · v4
            </p>
            <h3 className="mt-1 bg-gradient-to-r from-white via-violet-100 to-cyan-200 bg-clip-text text-xl font-bold tracking-tight text-transparent">
              Import Express AliExpress
            </h3>
            <p className="mt-1 max-w-lg text-sm text-violet-100/70">
              Votre navigateur lit la fiche AE et injecte SKU, prix et variantes — sans API officielle.
            </p>
          </div>
          {phase === "received" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Catalogue synchronisé
            </span>
          ) : phase === "waiting" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Écoute active…
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative space-y-4 px-5 py-5">
        {!bookmarkletInstalled ? (
          <div className="rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-4 py-3 text-sm text-amber-50">
            <strong className="text-amber-200">Installation unique :</strong> glissez le favori depuis{" "}
            <a href="/admin/ae-bookmarklet" className="font-semibold text-cyan-300 underline">
              /admin/ae-bookmarklet
            </a>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { n: "01", t: "Lancer le pont", d: "Ouvre AliExpress avec contexte sécurisé" },
            { n: "02", t: "Favori Import AE", d: "1 clic sur la fiche produit AE" },
            { n: "03", t: "Auto-remplissage", d: "SKU + prix mappés ici" },
          ].map((step) => (
            <div
              key={step.n}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur-sm"
            >
              <p className="font-mono text-[10px] text-cyan-400/90">{step.n}</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{step.t}</p>
              <p className="mt-0.5 text-[11px] text-violet-200/60">{step.d}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!canLaunch || phase === "waiting"}
            className="border-0 bg-gradient-to-r from-cyan-400 to-violet-500 font-semibold text-zinc-950 shadow-lg shadow-violet-500/30 hover:from-cyan-300 hover:to-violet-400"
            onClick={() => void launchImport()}
          >
            <Rocket className="mr-2 h-4 w-4" aria-hidden />
            Lancer import express
          </Button>

          {!bookmarkletInstalled ? (
            <a
              href={universalBookmarkletHref}
              onClick={markInstalled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur hover:bg-white/10"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Installer favori universel
            </a>
          ) : null}

          {phase === "waiting" && sessionBookmarkletHref ? (
            <>
              <a
                href={sessionBookmarkletHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/50 bg-violet-500/20 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/30"
                title="À utiliser sur l’onglet AliExpress si le favori ne détecte pas la session"
              >
                <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
                Lien session (AE)
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-violet-200 hover:bg-white/10 hover:text-white"
                onClick={() => void copySessionLink()}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                {copied ? "Copié" : "Copier lien"}
              </Button>
            </>
          ) : null}
        </div>

        {phase === "waiting" ? (
          <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
            <Zap className="h-4 w-4 shrink-0 text-cyan-400 animate-pulse" aria-hidden />
            <p className="text-xs text-cyan-100/90">
              Le contexte est aussi passé dans l&apos;URL AliExpress (#affisellAfc). Si le favori échoue,
              utilisez <strong>Lien session</strong> sur la fiche AE.
            </p>
          </div>
        ) : null}

        {hint ? (
          <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-violet-100/90">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}
