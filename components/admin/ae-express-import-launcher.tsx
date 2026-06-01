"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  X,
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

type Phase = "idle" | "waiting" | "stalled" | "received"

const BOOKMARKLET_INSTALLED_KEY = "affisell.aeImportBookmarklet.v6"
const BOOKMARKLET_ORIGIN_KEY = "affisell.aeImportBookmarklet.origin"
const POLL_MS = 200
const POLL_MAX = 300
const STALL_SEC = 25

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
  const [waitSec, setWaitSec] = useState(0)
  const [originMismatch, setOriginMismatch] = useState(false)
  const pollRef = useRef<number | null>(null)
  const waitTickRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const sessionCaptureRef = useRef(sessionCapture)
  sessionCaptureRef.current = sessionCapture

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
    if (waitTickRef.current != null) {
      window.clearInterval(waitTickRef.current)
      waitTickRef.current = null
    }
  }, [])

  const finishCapture = useCallback(
    (result: AeCaptureResult) => {
      stopPolling()
      setPhase("received")
      setSessionCapture(null)
      sessionIdRef.current = null
      onCapture(result)
      setHint(null)
      setWaitSec(0)
      window.setTimeout(() => setPhase("idle"), 2500)
    },
    [onCapture, stopPolling]
  )

  const ingestAerPayload = useCallback(
    async (payload: {
      aeUrl: string
      aerData: unknown
      sessionId?: string
      captureToken?: string
    }): Promise<boolean> => {
      const sc = sessionCaptureRef.current
      setHint("Réception catalogue…")
      try {
        const res = await fetch(`/api/admin/products/${productId}/ae-capture`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aeUrl: payload.aeUrl,
            aerData: payload.aerData,
            sessionId: payload.sessionId ?? sc?.sessionId ?? sessionIdRef.current ?? undefined,
            captureToken: payload.captureToken ?? sc?.captureToken,
          }),
        })
        const data = (await res.json()) as AeCaptureResult & { error?: string; ok?: boolean }
        if (!res.ok || !data.resolved) {
          setHint(data.error ?? "Import impossible — essayez Plan B (JSON).")
          return false
        }
        finishCapture({
          resolved: data.resolved,
          suggestions: data.suggestions ?? [],
        })
        return true
      } catch {
        setHint("Erreur réseau lors de l’import.")
        return false
      }
    },
    [finishCapture, productId]
  )

  const tryReceive = useCallback(
    async (sessionId: string, consume: boolean): Promise<boolean> => {
      try {
        const q = new URLSearchParams({ sessionId })
        if (consume) q.set("consume", "1")
        const res = await fetch(`/api/admin/products/${productId}/ae-capture/poll?${q}`, {
          credentials: "include",
          cache: "no-store",
        })
        const data = (await res.json()) as {
          ready?: boolean
          resolved?: AeCaptureResult["resolved"]
          suggestions?: AeCaptureResult["suggestions"]
        }
        if (!data.ready || !data.resolved) return false
        finishCapture({
          resolved: data.resolved,
          suggestions: data.suggestions ?? [],
        })
        return true
      } catch {
        return false
      }
    },
    [finishCapture, productId]
  )

  const startPolling = useCallback(
    (sessionId: string) => {
      stopPolling()
      sessionIdRef.current = sessionId
      setWaitSec(0)
      setPhase("waiting")

      waitTickRef.current = window.setInterval(() => {
        setWaitSec((s) => {
          const next = s + 1
          if (next >= STALL_SEC) setPhase((p) => (p === "waiting" ? "stalled" : p))
          return next
        })
      }, 1000)

      let attempts = 0
      const tick = () => {
        attempts += 1
        if (attempts > POLL_MAX) {
          stopPolling()
          setPhase("stalled")
          setHint(
            "Délai dépassé. Sur l’onglet AliExpress : clic sur le favori « Affisell Import AE », puis « Vérifier maintenant »."
          )
          return
        }
        void tryReceive(sessionId, true)
      }

      tick()
      pollRef.current = window.setInterval(tick, POLL_MS)
    },
    [stopPolling, tryReceive]
  )

  const cancelWaiting = useCallback(() => {
    stopPolling()
    setPhase("idle")
    setSessionCapture(null)
    sessionIdRef.current = null
    setWaitSec(0)
    setHint("Import annulé.")
  }, [stopPolling])

  const checkNow = useCallback(() => {
    const sid = sessionIdRef.current
    if (!sid) return
    setHint("Vérification…")
    void tryReceive(sid, true).then((ok) => {
      if (!ok) setHint("Pas encore reçu — cliquez le favori sur la page AliExpress, puis réessayez.")
    })
  }, [tryReceive])

  useEffect(() => {
    try {
      setBookmarkletInstalled(localStorage.getItem(BOOKMARKLET_INSTALLED_KEY) === "1")
      const savedOrigin = localStorage.getItem(BOOKMARKLET_ORIGIN_KEY)
      if (savedOrigin && savedOrigin !== appOrigin) setOriginMismatch(true)
    } catch {
      setBookmarkletInstalled(false)
    }
    return () => stopPolling()
  }, [appOrigin, stopPolling])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data && typeof event.data === "object") {
        const rec = event.data as Record<string, unknown>
        if (rec.type === "AFFISELL_AE_CAPTURE_OK" && sessionIdRef.current) {
          void tryReceive(sessionIdRef.current, true)
        }
      }
      if (isCaptureDoneMessage(event.data, productId) && event.origin === appOrigin) {
        const sid = sessionIdRef.current
        if (sid) {
          finishCapture({
            resolved: event.data.resolved,
            suggestions: event.data.suggestions ?? [],
          })
        }
        return
      }
      if (isAffisellAeCaptureMessage(event.data, productId)) {
        if (!isAliExpressOrigin(event.origin) && event.origin !== appOrigin) return
        void ingestAerPayload({
          aeUrl: event.data.aeUrl,
          aerData: event.data.aerData,
          sessionId: event.data.sessionId,
          captureToken: event.data.captureToken,
        })
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [appOrigin, finishCapture, ingestAerPayload, productId, tryReceive])

  const markInstalled = useCallback(() => {
    try {
      localStorage.setItem(BOOKMARKLET_INSTALLED_KEY, "1")
      localStorage.setItem(BOOKMARKLET_ORIGIN_KEY, appOrigin)
      setOriginMismatch(false)
    } catch {
      /* ignore */
    }
    setBookmarkletInstalled(true)
  }, [appOrigin])

  const copySessionLink = useCallback(async () => {
    if (!sessionBookmarkletHref) return
    try {
      await navigator.clipboard.writeText(sessionBookmarkletHref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      setHint("Lien copié — créez un favori sur AliExpress avec cette URL (champ Adresse).")
    } catch {
      setHint("Sélectionnez et copiez le lien session manuellement.")
    }
  }, [sessionBookmarkletHref])

  const launchImport = useCallback(async () => {
    const url = aeUrl.trim()
    if (!url.includes("aliexpress")) return
    setPhase("waiting")
    setHint("Ouverture AliExpress…")

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

      const aeTarget = appendAeCaptureContextToUrl(url, productId, data.sessionId, data.captureToken)
      window.open(aeTarget, "affisellAeProduct", "noopener,noreferrer")

      setHint(
        "Onglet AliExpress ouvert → cliquez le favori « Affisell Import AE » sur la fiche produit (1–3 s après)."
      )
    } catch {
      setPhase("idle")
      setHint("Erreur réseau — réessayez.")
    }
  }, [aeUrl, productId, startPolling])

  const canLaunch = aeUrl.trim().includes("aliexpress") && !disabled
  const isWaiting = phase === "waiting" || phase === "stalled"

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
              Neural Bridge · v6
            </p>
            <h3 className="mt-1 bg-gradient-to-r from-white via-violet-100 to-cyan-200 bg-clip-text text-xl font-bold tracking-tight text-transparent">
              Import Express AliExpress
            </h3>
          </div>
          {phase === "received" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Reçu
            </span>
          ) : isWaiting ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                phase === "stalled"
                  ? "border border-orange-400/40 bg-orange-500/15 text-orange-100"
                  : "border border-amber-400/40 bg-amber-500/15 text-amber-100"
              }`}
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {phase === "stalled" ? `En attente · ${waitSec}s` : `Écoute · ${waitSec}s`}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative space-y-4 px-5 py-5">
        {originMismatch ? (
          <div className="rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-50">
            <strong>Favori incompatible :</strong> installé pour un autre domaine que{" "}
            <code className="text-xs">{appOrigin}</code>. Réinstallez depuis{" "}
            <a href="/admin/ae-bookmarklet" className="underline">
              /admin/ae-bookmarklet
            </a>{" "}
            (sur ce même site).
          </div>
        ) : null}

        {!bookmarkletInstalled ? (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            Installez le favori depuis{" "}
            <a href="/admin/ae-bookmarklet" className="font-semibold text-cyan-300 underline">
              /admin/ae-bookmarklet
            </a>{" "}
            (glisser le bouton blanc vers la barre de favoris).
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={!canLaunch || isWaiting}
            className="border-0 bg-gradient-to-r from-cyan-400 to-violet-500 font-semibold text-zinc-950"
            onClick={() => void launchImport()}
          >
            <Rocket className="mr-2 h-4 w-4" aria-hidden />
            Lancer import express
          </Button>

          {isWaiting ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={checkNow}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Vérifier maintenant
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-violet-200 hover:bg-white/10"
                onClick={cancelWaiting}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Annuler
              </Button>
            </>
          ) : null}

          {!bookmarkletInstalled ? (
            <a
              href={universalBookmarkletHref}
              onClick={markInstalled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/90"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Installer favori
            </a>
          ) : null}
        </div>

        {isWaiting && sessionBookmarkletHref ? (
          <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-50">
            <p className="font-semibold text-violet-100">Étape 2 — sur l’onglet AliExpress</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-violet-200/90">
              <li>Attendez que la fiche produit soit chargée.</li>
              <li>
                Cliquez le favori <strong>Affisell Import AE</strong> dans la barre de favoris.
              </li>
              <li>
                Si rien ne se passe : copiez le lien session, créez un favori AE, ou réinstallez le
                favori depuis <code className="text-[10px]">{appOrigin}</code>.
              </li>
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-white/10 text-white"
                onClick={() => void copySessionLink()}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                {copied ? "Copié" : "Copier lien session"}
              </Button>
              <span className="self-center text-[10px] text-violet-300/70">
                (ne cliquez pas « Lien session » ici — il faut le favori sur AE)
              </span>
            </div>
          </div>
        ) : null}

        {phase === "stalled" ? (
          <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
            <Zap className="h-4 w-4 text-orange-300" aria-hidden />
            <p className="text-xs text-orange-100">
              Toujours rien ? Favori installé sur <strong>{appOrigin}</strong> ? Cliquez le favori sur
              AliExpress puis <strong>Vérifier maintenant</strong>.
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
