"use client"

import { useState } from "react"
import { ClipboardPaste, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { AeCaptureResult } from "@/components/admin/ae-express-import-launcher"

type Props = {
  productId: string
  aeUrl: string
  disabled?: boolean
  onCapture: (result: AeCaptureResult) => void
}

export function AePasteCatalogPanel({ productId, aeUrl, disabled, onCapture }: Props) {
  const [open, setOpen] = useState(false)
  const [json, setJson] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function applyPaste() {
    const url = aeUrl.trim()
    if (!url.includes("aliexpress")) {
      setError("Renseignez d’abord l’URL AliExpress.")
      return
    }
    let aerData: unknown
    try {
      aerData = JSON.parse(json.trim()) as unknown
    } catch {
      setError("JSON invalide — collez le bloc __AER_DATA__ ou la réponse réseau AE.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/ae-capture`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aeUrl: url, aerData }),
      })
      const data = (await res.json()) as AeCaptureResult & { error?: string; ok?: boolean }
      if (!res.ok || !data.resolved) {
        throw new Error(data.error ?? "Import JSON impossible")
      }
      onCapture({
        resolved: data.resolved,
        suggestions: data.suggestions ?? [],
      })
      setJson("")
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-800 dark:text-zinc-200"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-zinc-500" aria-hidden />
          Plan B — coller le catalogue AE (JSON)
        </span>
        <span className="text-xs text-zinc-500">{open ? "Masquer" : "Afficher"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-zinc-200 px-4 pb-4 pt-3 dark:border-zinc-800">
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Sur AliExpress : DevTools → Network → filtre <code className="text-[10px]">mtop.aliexpress</code> ou
            copiez <code className="text-[10px]">window.__AER_DATA__</code> dans la console, puis collez ici.
          </p>
          <div>
            <Label htmlFor="ae-paste-json" className="text-xs">
              JSON catalogue
            </Label>
            <textarea
              id="ae-paste-json"
              className="mt-1 min-h-[120px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
              value={json}
              disabled={disabled || busy}
              onChange={(e) => setJson(e.target.value)}
              placeholder='{"pageModule":{...}} ou __AER_DATA__'
            />
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button type="button" size="sm" variant="secondary" disabled={disabled || busy} onClick={() => void applyPaste()}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Importer le JSON
          </Button>
        </div>
      ) : null}
    </div>
  )
}
