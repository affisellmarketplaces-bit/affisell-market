"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Loader2, Sparkles, Zap } from "lucide-react"

import { buildAeCaptureWindowName } from "@/lib/fulfillment/ae-capture-token"
import { appendAeCaptureContextToUrl } from "@/lib/fulfillment/ae-import-bookmarklet"

type CapturePayload = {
  resolved: unknown
  suggestions: unknown
}

type Props = {
  productId: string
  sessionId: string
  captureToken: string
  aeUrl: string
  appOrigin: string
}

const POLL_MS = 450
const POLL_MAX = 260

export function AeImportRelayClient({
  productId,
  sessionId,
  captureToken,
  aeUrl,
  appOrigin,
}: Props) {
  const [status, setStatus] = useState<"opening" | "waiting" | "done" | "error">("opening")
  const [detail, setDetail] = useState<string | null>("Initialisation du pont…")
  const pollRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  const aeTarget = useMemo(() => {
    const base = aeUrl.trim().split("#")[0] ?? aeUrl.trim()
    return appendAeCaptureContextToUrl(base, productId, sessionId, captureToken)
  }, [aeUrl, captureToken, productId, sessionId])

  const windowName = useMemo(
    () => buildAeCaptureWindowName(productId, sessionId, captureToken),
    [captureToken, productId, sessionId]
  )

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const notifyOpenerAndClose = useCallback(
    (payload: CapturePayload) => {
      if (doneRef.current) return
      doneRef.current = true
      stopPolling()
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: "AFFISELL_AE_CAPTURE_DONE",
            productId,
            sessionId,
            resolved: payload.resolved,
            suggestions: payload.suggestions,
          },
          appOrigin
        )
      }
      setStatus("done")
      setDetail("Catalogue importé — retour à Affisell…")
      window.setTimeout(() => window.close(), 800)
    },
    [appOrigin, productId, sessionId, stopPolling]
  )

  const startPolling = useCallback(() => {
    stopPolling()
    let attempts = 0
    pollRef.current = window.setInterval(() => {
      attempts += 1
      if (attempts > POLL_MAX) {
        stopPolling()
        setStatus("error")
        setDetail("Délai dépassé — recliquez le favori Import AE sur AliExpress.")
        return
      }
      void fetch(
        `/api/admin/products/${productId}/ae-capture/poll?sessionId=${encodeURIComponent(sessionId)}`,
        { credentials: "include" }
      )
        .then((r) => r.json())
        .then((data: { ready?: boolean; resolved?: unknown; suggestions?: unknown }) => {
          if (!data.ready || !data.resolved) return
          notifyOpenerAndClose({
            resolved: data.resolved,
            suggestions: data.suggestions ?? [],
          })
        })
        .catch(() => {})
    }, POLL_MS)
  }, [notifyOpenerAndClose, productId, sessionId, stopPolling])

  const openAliExpress = useCallback(() => {
    const aeWin = window.open("about:blank", "affisellAeProduct")
    if (!aeWin) {
      setStatus("error")
      setDetail("Popup bloquée — autorisez les popups pour affisell.com.")
      return false
    }
    try {
      aeWin.name = windowName
      aeWin.location.replace(aeTarget)
    } catch {
      aeWin.location.href = aeTarget
    }
    return true
  }, [aeTarget, windowName])

  useEffect(() => {
    startPolling()
    if (!openAliExpress()) return () => stopPolling()
    setStatus("waiting")
    setDetail("Sur AliExpress : favori « Affisell Import AE » (contexte injecté dans l’URL).")
    return () => stopPolling()
  }, [openAliExpress, startPolling, stopPolling])

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 text-center text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(139,92,246,0.35), transparent)",
        }}
      />
      <div className="relative">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
          <Sparkles className="h-4 w-4" aria-hidden />
          Affisell Bridge
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Pont AliExpress actif</h1>
        <p className="mt-3 max-w-sm text-sm text-zinc-400">{detail}</p>
        {status === "waiting" || status === "opening" ? (
          <Loader2 className="mx-auto mt-8 h-10 w-10 animate-spin text-violet-400" aria-hidden />
        ) : null}
        {status === "done" ? (
          <CheckCircle2 className="mx-auto mt-8 h-12 w-12 text-emerald-400" aria-hidden />
        ) : null}
        {status === "error" ? (
          <button
            type="button"
            className="mt-8 rounded-xl border border-violet-500/40 bg-violet-500/20 px-5 py-2.5 text-sm font-medium hover:bg-violet-500/30"
            onClick={() => {
              doneRef.current = false
              setStatus("opening")
              startPolling()
              if (openAliExpress()) {
                setStatus("waiting")
                setDetail("Recliquez le favori sur la page produit AliExpress.")
              }
            }}
          >
            Rouvrir AliExpress
          </button>
        ) : null}
        {status === "waiting" ? (
          <p className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-1.5 text-[11px] text-violet-300/80">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Session sécurisée · hash URL + favori v4
          </p>
        ) : null}
      </div>
    </main>
  )
}
