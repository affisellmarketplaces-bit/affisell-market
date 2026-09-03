"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Loader2, Sparkles, Zap } from "lucide-react"

import { buildAeCaptureWindowName } from "@/lib/fulfillment/ae-capture-token"
import {
  appendAeCaptureContextToUrl,
  buildDropForgeAeImportBookmarklet,
} from "@/lib/fulfillment/ae-import-bookmarklet"

type PreviewPayload = {
  preview?: Record<string, unknown>
}

type Props = {
  relayKey: string
  sessionId: string
  captureToken: string
  aeUrl: string
  appOrigin: string
}

const POLL_MS = 450
const POLL_MAX = 320
const AUTO_RUN_MS = 6000

export function DropForgeAeRelayClient({
  relayKey,
  sessionId,
  captureToken,
  aeUrl,
  appOrigin,
}: Props) {
  const [status, setStatus] = useState<"opening" | "waiting" | "done" | "error">("opening")
  const [detail, setDetail] = useState<string | null>("Ouverture AliExpress dans votre navigateur…")
  const pollRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const aeWinRef = useRef<Window | null>(null)

  const aeTarget = useMemo(() => {
    const base = aeUrl.trim().split("#")[0] ?? aeUrl.trim()
    return appendAeCaptureContextToUrl(base, relayKey, sessionId, captureToken)
  }, [aeUrl, captureToken, relayKey, sessionId])

  const windowName = useMemo(
    () => buildAeCaptureWindowName(relayKey, sessionId, captureToken),
    [captureToken, relayKey, sessionId]
  )

  const bookmarkletHref = useMemo(
    () => buildDropForgeAeImportBookmarklet(appOrigin, relayKey, sessionId, captureToken),
    [appOrigin, captureToken, relayKey, sessionId]
  )

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const notifyOpenerAndClose = useCallback(
    (payload: PreviewPayload) => {
      if (doneRef.current) return
      doneRef.current = true
      stopPolling()
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: "AFFISELL_DROPFORGE_AE_IMPORT_DONE",
            relayKey,
            sessionId,
            preview: payload.preview,
          },
          appOrigin
        )
      }
      setStatus("done")
      setDetail("Produit capturé — retour à DropForge…")
      window.setTimeout(() => window.close(), 800)
    },
    [appOrigin, relayKey, sessionId, stopPolling]
  )

  const startPolling = useCallback(() => {
    stopPolling()
    let attempts = 0
    pollRef.current = window.setInterval(() => {
      attempts += 1
      if (attempts > POLL_MAX) {
        stopPolling()
        setStatus("error")
        setDetail(
          "Délai dépassé — sur AliExpress, cliquez le favori « Affisell Import AE » ou réouvrez la page."
        )
        return
      }
      void fetch(`/api/dropforge/ae-capture/${encodeURIComponent(relayKey)}/poll?consume=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, captureToken }),
      })
        .then((r) => r.json())
        .then((data: { ready?: boolean; preview?: Record<string, unknown> }) => {
          if (!data.ready || !data.preview) return
          notifyOpenerAndClose({ preview: data.preview })
        })
        .catch(() => {})
    }, POLL_MS)
  }, [captureToken, notifyOpenerAndClose, relayKey, sessionId, stopPolling])

  const tryAutoCapture = useCallback(() => {
    const win = aeWinRef.current
    if (!win || win.closed) return
    try {
      win.location.href = bookmarkletHref
      setDetail("Capture automatique en cours sur AliExpress…")
    } catch {
      setDetail(
        "Page AliExpress ouverte — si rien ne se passe, cliquez le favori « Affisell Import AE »."
      )
    }
  }, [bookmarkletHref])

  const openAliExpress = useCallback(() => {
    const aeWin = window.open("about:blank", "affisellDropForgeAe")
    if (!aeWin) {
      setStatus("error")
      setDetail("Popup bloquée — autorisez les popups pour affisell.com.")
      return false
    }
    aeWinRef.current = aeWin
    try {
      aeWin.name = windowName
      aeWin.location.replace(aeTarget)
    } catch {
      aeWin.location.href = aeTarget
    }
    window.setTimeout(() => tryAutoCapture(), AUTO_RUN_MS)
    return true
  }, [aeTarget, tryAutoCapture, windowName])

  useEffect(() => {
    startPolling()
    if (!openAliExpress()) return () => stopPolling()
    setStatus("waiting")
    setDetail("AliExpress s’ouvre — la capture démarre automatiquement (~6 s).")
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
      <div className="relative max-w-md">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300">
          <Sparkles className="h-4 w-4" aria-hidden />
          DropForge Express Bridge
        </p>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Import AliExpress navigateur</h1>
        <p className="mt-3 text-sm text-zinc-400">{detail}</p>
        {status === "waiting" || status === "opening" ? (
          <Loader2 className="mx-auto mt-8 h-10 w-10 animate-spin text-violet-400" aria-hidden />
        ) : null}
        {status === "done" ? (
          <CheckCircle2 className="mx-auto mt-8 h-12 w-12 text-emerald-400" aria-hidden />
        ) : null}
        {status === "error" ? (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              className="rounded-xl border border-violet-500/40 bg-violet-500/20 px-5 py-2.5 text-sm font-medium hover:bg-violet-500/30"
              onClick={() => {
                doneRef.current = false
                setStatus("opening")
                startPolling()
                if (openAliExpress()) {
                  setStatus("waiting")
                  setDetail("Réessayez — favori Import AE sur la page produit si besoin.")
                }
              }}
            >
              Rouvrir AliExpress
            </button>
            <p className="text-xs text-zinc-500">
              Installez le favori{" "}
              <a href={bookmarkletHref} className="text-violet-300 underline">
                Affisell Import AE
              </a>{" "}
              pour capturer manuellement.
            </p>
          </div>
        ) : null}
        {status === "waiting" ? (
          <p className="mx-auto mt-6 flex max-w-xs items-center justify-center gap-1.5 text-[11px] text-violet-300/80">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Votre navigateur lit la page — Affisell ne peut pas scraper AliExpress côté serveur.
          </p>
        ) : null}
      </div>
    </main>
  )
}
