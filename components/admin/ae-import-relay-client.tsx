"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Loader2, Zap } from "lucide-react"

import {
  isAffisellAeCaptureMessage,
  isAliExpressOrigin,
} from "@/lib/fulfillment/ae-import-bookmarklet"

type Props = {
  productId: string
  sessionId: string
  aeUrl: string
  appOrigin: string
}

export function AeImportRelayClient({ productId, sessionId, aeUrl, appOrigin }: Props) {
  const [status, setStatus] = useState<"opening" | "waiting" | "done" | "error">("opening")
  const [detail, setDetail] = useState<string | null>(null)

  const aeTarget = useMemo(() => {
    const base = aeUrl.trim().split("#")[0] ?? aeUrl.trim()
    return `${base}#afc=${encodeURIComponent(sessionId)}`
  }, [aeUrl, sessionId])

  const forwardCapture = useCallback(
    async (aeUrlCaptured: string, aerData: unknown) => {
      setStatus("waiting")
      setDetail("Envoi du catalogue à Affisell…")
      try {
        const res = await fetch(`/api/admin/products/${productId}/ae-capture`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            aeUrl: aeUrlCaptured,
            aerData,
          }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          error?: string
          resolved?: unknown
          suggestions?: unknown
        }
        if (!res.ok || !data.ok) {
          setStatus("error")
          setDetail(data.error ?? "Import impossible")
          return
        }
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "AFFISELL_AE_CAPTURE_DONE",
              productId,
              sessionId,
              resolved: data.resolved,
              suggestions: data.suggestions,
            },
            appOrigin
          )
        }
        setStatus("done")
        setDetail("Catalogue importé — retour à Affisell…")
        window.setTimeout(() => window.close(), 800)
      } catch (e) {
        setStatus("error")
        setDetail(e instanceof Error ? e.message : "Erreur réseau")
      }
    },
    [appOrigin, productId, sessionId]
  )

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAliExpressOrigin(event.origin)) return
      if (!isAffisellAeCaptureMessage(event.data, productId)) return
      void forwardCapture(event.data.aeUrl, event.data.aerData)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [forwardCapture, productId])

  useEffect(() => {
    window.open(aeTarget, "affisellAeProduct")
    setStatus("waiting")
    setDetail("Cliquez le favori Affisell Import AE sur la page produit.")
  }, [aeTarget])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-white">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
        <Zap className="h-4 w-4" aria-hidden />
        Import Express
      </p>
      <h1 className="mt-2 text-lg font-semibold">Pont Affisell ↔ AliExpress</h1>
      <p className="mt-3 max-w-sm text-sm text-zinc-300">{detail}</p>
      {status === "waiting" ? (
        <Loader2 className="mt-6 h-8 w-8 animate-spin text-fuchsia-400" aria-hidden />
      ) : null}
      {status === "done" ? (
        <CheckCircle2 className="mt-6 h-10 w-10 text-emerald-400" aria-hidden />
      ) : null}
      {status === "error" ? (
        <button
          type="button"
          className="mt-6 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
          onClick={() => window.open(aeTarget, "affisellAeProduct")}
        >
          Rouvrir AliExpress
        </button>
      ) : null}
    </main>
  )
}
