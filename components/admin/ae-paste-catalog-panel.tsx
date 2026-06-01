"use client"

import { useState } from "react"
import { Check, ClipboardCopy, ClipboardPaste, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { AeCaptureResult } from "@/components/admin/ae-express-import-launcher"
import {
  AE_CONSOLE_COPY_SNIPPET,
  parsePastedAerJson,
} from "@/lib/fulfillment/parse-pasted-aer-json"

type Props = {
  productId: string
  aeUrl: string
  disabled?: boolean
  onCapture: (result: AeCaptureResult) => void
}

export function AePasteCatalogPanel({ productId, aeUrl, disabled, onCapture }: Props) {
  const [open, setOpen] = useState(true)
  const [json, setJson] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snippetCopied, setSnippetCopied] = useState(false)

  async function copyConsoleSnippet() {
    try {
      await navigator.clipboard.writeText(AE_CONSOLE_COPY_SNIPPET)
      setSnippetCopied(true)
      window.setTimeout(() => setSnippetCopied(false), 2500)
    } catch {
      setError("Copiez manuellement la commande console ci-dessous.")
    }
  }

  async function applyPaste() {
    const url = aeUrl.trim()
    if (!url.includes("aliexpress")) {
      setError("Renseignez d’abord l’URL AliExpress.")
      return
    }

    let aerData: unknown
    try {
      aerData = parsePastedAerJson(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "JSON invalide")
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
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/20 to-zinc-950/40 dark:border-emerald-800/50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-emerald-100"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4 text-emerald-400" aria-hidden />
          Plan B — JSON catalogue (fiable, ~30 s)
        </span>
        <span className="text-xs text-emerald-300/70">{open ? "Masquer" : "Afficher"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-emerald-500/20 px-4 pb-4 pt-3">
          <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-emerald-100/80">
            <li>Ouvrez la fiche produit sur AliExpress (même URL que ci-dessus).</li>
            <li>
              <kbd className="rounded bg-black/30 px-1">F12</kbd> → onglet{" "}
              <strong>Console</strong>.
            </li>
            <li>
              Collez la commande ci-dessous, <strong>Entrée</strong> → le JSON est dans le presse-papiers.
            </li>
            <li>Revenez ici → collez dans la zone → <strong>Importer le JSON</strong>.</li>
          </ol>

          <div className="rounded-lg border border-emerald-500/25 bg-black/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Commande console (AliExpress)
            </p>
            <code className="mt-2 block break-all font-mono text-[10px] text-emerald-50/90">
              {AE_CONSOLE_COPY_SNIPPET}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              onClick={() => void copyConsoleSnippet()}
            >
              {snippetCopied ? (
                <Check className="mr-1 h-3.5 w-3.5" />
              ) : (
                <ClipboardCopy className="mr-1 h-3.5 w-3.5" />
              )}
              {snippetCopied ? "Copié" : "Copier la commande"}
            </Button>
          </div>

          <div>
            <Label htmlFor="ae-paste-json" className="text-xs text-emerald-200">
              JSON catalogue (Ctrl+V)
            </Label>
            <textarea
              id="ae-paste-json"
              className="mt-1 min-h-[100px] w-full rounded-lg border border-emerald-500/30 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-emerald-50"
              value={json}
              disabled={disabled || busy}
              onChange={(e) => setJson(e.target.value)}
              placeholder='Collez ici après "copy(...)" dans la console AE'
            />
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={disabled || busy || !json.trim()}
            onClick={() => void applyPaste()}
          >
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Importer le JSON
          </Button>
        </div>
      ) : null}
    </div>
  )
}
