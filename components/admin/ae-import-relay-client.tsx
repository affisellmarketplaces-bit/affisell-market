"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Loader2, Zap } from "lucide-react"

import { buildAeCaptureWindowName } from "@/lib/fulfillment/ae-capture-token"

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

const POLL_MS = 400
const POLL_MAX = 120

export function AeImportRelayClient({
  productId,
  sessionId,
  captureToken,
  aeUrl,
  appOrigin,
}: Props) {
  const [status, setStatus] = useState<"opening" | "waiting" | "done" | "error">("opening")
  const [detail, setDetail] = useState<string | null>("Ouverture d'AliExpress…")
  const pollRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  const aeTarget = useMemo(() => aeUrl.trim().split("#")[0] ?? aeUrl.trim(), [aeUrl])

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
      window.setTimeout(() => window.close(), 700)
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
        setDetail("Délai dépassé — recliquez le favori sur AliExpress.")
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

  useEffect(() => {
    startPolling()
    const windowName = buildAeCaptureWindowName(productId, sessionId, captureToken)
    const aeWin = window.open("about:blank", "affisellAeProduct")
    if (aeWin) {
      try {
        aeWin.name = windowName
        aeWin.location.replace(aeTarget)
      } catch {
        aeWin.location.href = aeTarget
      }
    } else {
      setStatus("error")
      setDetail("Popup bloquée — autorisez les popups pour affisell.com.")
      return
    }
    setStatus("waiting")
    setDetail("Cliquez le favori Affisell Import AE sur la page produit.")
    return () => stopPolling()
  }, [aeTarget, captureToken, sessionId, startPolling, stopPolling])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-white">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
        <Zap className="h-4 w-4" aria-hidden />
        Import Express
      </p>
      <h1 className="mt-2 text-lg font-semibold">Pont Affisell ↔ AliExpress</h1>
      <p className="mt-3 max-w-sm text-sm text-zinc-300">{detail}</p>
      {status === "waiting" || status === "opening" ? (
        <Loader2 className="mt-6 h-8 w-8 animate-spin text-fuchsia-400" aria-hidden />
      ) : null}
      {status === "done" ? (
        <CheckCircle2 className="mt-6 h-10 w-10 text-emerald-400" aria-hidden />
      ) : null}
      {status === "error" ? (
        <button
          type="button"
          className="mt-6 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          onClick={() => {
            doneRef.current = false
            setStatus("opening")
            startPolling()
            const aeWin = window.open("about:blank", "affisellAeProduct")
            if (aeWin) {
              aeWin.name = buildAeCaptureWindowName(productId, sessionId, captureToken)
              aeWin.location.replace(aeTarget)
            }
            setStatus("waiting")
            setDetail("Cliquez le favori Affisell Import AE sur la page produit.")
          }}
        >
          Rouvrir AliExpress
        </button>
      ) : null}
    </main>
  )
}
