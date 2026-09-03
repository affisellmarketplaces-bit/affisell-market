"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ExternalLink, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { buildUniversalAeImportBookmarklet } from "@/lib/fulfillment/ae-import-bookmarklet"

type Preview = Record<string, unknown>

type Props = {
  aeUrl: string
  onPreview: (preview: Preview) => void
  onBusyChange?: (busy: boolean) => void
  autoStart?: boolean
}

export function DropForgeAeBrowserBridge({
  aeUrl,
  onPreview,
  onBusyChange,
  autoStart = false,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "running" | "error">("idle")
  const [hint, setHint] = useState<string | null>(null)
  const sessionRef = useRef<{
    relayKey: string
    sessionId: string
    captureToken: string
  } | null>(null)
  const startedAuto = useRef(false)

  const appOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://affisell.com")

  const bookmarkletHref = buildUniversalAeImportBookmarklet(appOrigin)

  const startBrowserImport = useCallback(async () => {
    const u = aeUrl.trim()
    if (!/^https?:\/\//i.test(u) || !u.includes("aliexpress")) return

    setHint("Préparation du pont Express Bridge…")

    try {
      const res = await fetch("/api/dropforge/ae-capture/session", { method: "POST" })
      const data = (await res.json()) as {
        relayKey?: string
        sessionId?: string
        captureToken?: string
        error?: string
      }
      if (!res.ok || !data.relayKey || !data.sessionId || !data.captureToken) {
        throw new Error(data.error ?? "session_failed")
      }

      sessionRef.current = {
        relayKey: data.relayKey,
        sessionId: data.sessionId,
        captureToken: data.captureToken,
      }

      const relayQs = new URLSearchParams({
        aeUrl: u,
        relayKey: data.relayKey,
        sessionId: data.sessionId,
        captureToken: data.captureToken,
      })
      const relayUrl = `/dropforge/ae-relay?${relayQs.toString()}`
      const popup = window.open(relayUrl, "affisellDropForgeAeRelay", "width=520,height=640")
      if (!popup) {
        throw new Error("Autorisez les popups pour affisell.com")
      }

      setPhase("running")
      onBusyChange?.(true)
      setHint("Fenêtre AliExpress ouverte — capture en cours…")
    } catch (e) {
      setPhase("error")
      onBusyChange?.(false)
      setHint(e instanceof Error ? e.message : "Pont indisponible")
    }
  }, [aeUrl, onBusyChange])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as {
        type?: string
        relayKey?: string
        preview?: Preview
      }
      if (data.type !== "AFFISELL_DROPFORGE_AE_IMPORT_DONE" || !data.preview) return
      const sess = sessionRef.current
      if (sess && data.relayKey && data.relayKey !== sess.relayKey) return

      setPhase("idle")
      onBusyChange?.(false)
      setHint(null)
      onPreview(data.preview)
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onBusyChange, onPreview])

  useEffect(() => {
    if (phase !== "running") return
    const sess = sessionRef.current
    if (!sess) return

    let attempts = 0
    const maxAttempts = 320
    const interval = window.setInterval(() => {
      attempts += 1
      if (attempts > maxAttempts) {
        window.clearInterval(interval)
        setPhase("error")
        onBusyChange?.(false)
        setHint(
          "Capture expirée — rouvrez le pont ou cliquez le favori « Import AE » sur la page produit."
        )
        return
      }

      void fetch(
        `/api/dropforge/ae-capture/${encodeURIComponent(sess.relayKey)}/poll?consume=1`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sess.sessionId,
            captureToken: sess.captureToken,
          }),
        }
      )
        .then((r) => r.json())
        .then((data: { ready?: boolean; preview?: Preview }) => {
          if (!data.ready || !data.preview) return
          window.clearInterval(interval)
          setPhase("idle")
          onBusyChange?.(false)
          setHint(null)
          onPreview(data.preview)
        })
        .catch(() => {})
    }, 450)

    return () => window.clearInterval(interval)
  }, [phase, onBusyChange, onPreview])

  useEffect(() => {
    if (!autoStart || startedAuto.current) return
    if (!aeUrl.includes("aliexpress")) return
    startedAuto.current = true
    void startBrowserImport()
  }, [autoStart, aeUrl, startBrowserImport])

  return (
    <div className="mt-4 rounded-2xl border border-violet-400/35 bg-gradient-to-br from-violet-600/15 via-fuchsia-500/10 to-cyan-500/10 p-4">
      <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-200">
        <Sparkles className="size-3.5" aria-hidden />
        Express Bridge · AliExpress
      </p>
      <p className="mt-2 text-sm leading-relaxed text-violet-50/95">
        AliExpress bloque le scrape serveur. Le pont ouvre la page dans votre navigateur et importe
        la fiche complète (variantes, images, prix) — sans ScrapingBee.
      </p>
      {hint ? <p className="mt-2 text-xs text-violet-200/80">{hint}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-full bg-violet-600 hover:bg-violet-500"
          disabled={phase === "running"}
          onClick={() => void startBrowserImport()}
        >
          {phase === "running" ? (
            <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
          ) : (
            <ExternalLink className="mr-1.5 size-4" aria-hidden />
          )}
          Lancer le pont navigateur
        </Button>
        <a
          href={bookmarkletHref}
          className="inline-flex items-center rounded-full border border-white/20 px-3 py-1.5 text-xs text-violet-100 hover:bg-white/10"
        >
          Favori Import AE
        </a>
      </div>
      {phase === "error" && hint ? (
        <p className="mt-2 text-xs text-amber-200/90">{hint}</p>
      ) : null}
    </div>
  )
}
