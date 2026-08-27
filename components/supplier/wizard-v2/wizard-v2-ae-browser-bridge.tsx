"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ExternalLink, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { buildUniversalAeImportBookmarklet } from "@/lib/fulfillment/ae-import-bookmarklet"

export type WizardV2AeImportData = {
  products?: unknown[]
  error?: string
  warnings?: string[]
  method?: string
  category?: { leafId?: string | null; breadcrumb?: string } | null
  skuVariants?: {
    hasVariants?: boolean
    variants?: unknown[]
  } | null
}

type Props = {
  aeUrl: string
  onImport: (data: WizardV2AeImportData) => void
  onBusyChange?: (busy: boolean) => void
  autoStart?: boolean
}

export function WizardV2AeBrowserBridge({
  aeUrl,
  onImport,
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

    setPhase("running")
    onBusyChange?.(true)
    setHint("Préparation du pont navigateur…")

    try {
      const res = await fetch("/api/supplier/wizard-v2/ae-capture/session", {
        method: "POST",
        credentials: "include",
      })
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
      const relayUrl = `/dashboard/supplier/products/new/ae-relay?${relayQs.toString()}`
      const popup = window.open(relayUrl, "affisellWizardAeRelay", "width=520,height=640")
      if (!popup) {
        throw new Error("Autorisez les popups pour affisell.com")
      }

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
        import?: WizardV2AeImportData
      }
      if (data.type !== "AFFISELL_WIZARD_AE_IMPORT_DONE" || !data.import) return
      const sess = sessionRef.current
      if (sess && data.relayKey && data.relayKey !== sess.relayKey) return

      setPhase("idle")
      onBusyChange?.(false)
      setHint(null)
      onImport(data.import)
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onBusyChange, onImport])

  useEffect(() => {
    if (!autoStart || startedAuto.current) return
    startedAuto.current = true
    void startBrowserImport()
  }, [autoStart, startBrowserImport])

  return (
    <div
      className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-violet-50 p-4 dark:border-amber-900/40 dark:from-amber-950/30 dark:to-violet-950/20"
      role="region"
      aria-label="Import AliExpress via navigateur"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            AliExpress bloque le serveur — import via votre navigateur
          </p>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Affisell ouvre la page produit dans votre session Chrome (données réelles, variantes
            incluses). Aucune API ni ScrapingBee requis.
          </p>
          {hint ? (
            <p className="flex items-center gap-2 text-xs text-violet-700 dark:text-violet-300">
              {phase === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              {hint}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={phase === "running"}
              onClick={() => void startBrowserImport()}
              className="bg-zinc-900 hover:bg-zinc-800 dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              {phase === "running" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Ouvrir AliExpress et importer
            </Button>
            <a
              href={bookmarkletHref}
              className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white dark:border-zinc-600 dark:text-zinc-300"
              onClick={(e) => e.preventDefault()}
              title="Glissez vers la barre de favoris"
            >
              Favori Import AE
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
