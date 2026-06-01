"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  FileUp,
  Loader2,
  Server,
  Sparkles,
  Upload,
} from "lucide-react"

import type { AeCaptureResult } from "@/components/admin/ae-express-import-launcher"
import { Button } from "@/components/ui/button"
import { AE_CONSOLE_COPY_SNIPPET } from "@/lib/fulfillment/parse-pasted-aer-json"

type Props = {
  productId: string
  aeUrl: string
  disabled?: boolean
  onCapture: (result: AeCaptureResult) => void
  onAutoMap?: () => void
}

type Diagnostics = {
  apiConfigured: boolean
  scrapingBeeConfigured: boolean
}

export function AeCatalogImportHub({ productId, aeUrl, disabled, onCapture, onAutoMap }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [diag, setDiag] = useState<Diagnostics | null>(null)
  const [htmlFile, setHtmlFile] = useState<File | null>(null)
  const [jsonPaste, setJsonPaste] = useState("")
  const [snippetCopied, setSnippetCopied] = useState(false)

  useEffect(() => {
    void fetch(`/api/admin/products/${productId}/supplier-link/import-catalog`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d: { diagnostics?: Diagnostics }) => {
        if (d.diagnostics) setDiag(d.diagnostics)
      })
      .catch(() => {})
  }, [productId])

  const applyResult = useCallback(
    (data: AeCaptureResult & { source?: string }) => {
      onCapture({
        resolved: data.resolved,
        suggestions: data.suggestions ?? [],
      })
      onAutoMap?.()
      const n = data.resolved.aeSkus?.length ?? 0
      const src =
        data.source === "api"
          ? "API"
          : data.source === "html"
            ? "HTML"
            : data.source === "paste"
              ? "JSON"
              : "serveur"
      setSuccess(`${n} SKU importé(s) (${src}) — vérifiez le tableau puis Enregistrer.`)
      setError(null)
      setHtmlFile(null)
      setJsonPaste("")
    },
    [onAutoMap, onCapture]
  )

  const runImport = useCallback(
    async (body: FormData | Record<string, unknown>) => {
      const url = aeUrl.trim()
      if (!url.includes("aliexpress")) {
        setError("Collez d’abord l’URL AliExpress du produit.")
        return
      }

      setBusy(true)
      setError(null)
      setSuccess(null)

      try {
        const res =
          body instanceof FormData
            ? await fetch(`/api/admin/products/${productId}/supplier-link/import-catalog`, {
                method: "POST",
                credentials: "include",
                body,
              })
            : await fetch(`/api/admin/products/${productId}/supplier-link/import-catalog`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aeUrl: url, ...body }),
              })

        const data = (await res.json()) as AeCaptureResult & {
          ok?: boolean
          error?: string
          source?: string
          diagnostics?: Diagnostics
        }

        if (data.diagnostics) setDiag(data.diagnostics)

        if (!res.ok || !data.ok || !data.resolved) {
          throw new Error(data.error ?? "Import impossible")
        }

        applyResult(data)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Échec import"
        setError(msg)
      } finally {
        setBusy(false)
      }
    },
    [aeUrl, applyResult, productId]
  )

  const copySnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AE_CONSOLE_COPY_SNIPPET)
      setSnippetCopied(true)
      window.setTimeout(() => setSnippetCopied(false), 2000)
    } catch {
      setError("Copiez la commande console manuellement (bloc ci-dessous).")
    }
  }, [])

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-zinc-950 to-zinc-900 shadow-xl">
      <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Import catalogue
        </p>
        <h3 className="mt-1 text-lg font-bold text-white">Récupérer les SKU AliExpress</h3>
        <p className="mt-1 text-sm text-emerald-100/70">
          Si le fichier HTML échoue (page vide côté Safari), utilisez l’option JSON — 30 secondes,
          sans favori.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {diag ? (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span
              className={`rounded-full px-2.5 py-1 ${diag.apiConfigured ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-400"}`}
            >
              API AE {diag.apiConfigured ? "OK" : "off"}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 ${diag.scrapingBeeConfigured ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-400"}`}
            >
              ScrapingBee {diag.scrapingBeeConfigured ? "OK" : "off"}
            </span>
          </div>
        ) : null}

        <div className="rounded-xl border-2 border-cyan-500/30 bg-cyan-500/5 p-4">
          <p className="text-sm font-semibold text-cyan-100">Option 1 — JSON console (le plus fiable)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-cyan-100/80">
            <li>Fiche produit AliExpress → <kbd className="rounded bg-black/40 px-1">F12</kbd> → Console</li>
            <li>Collez la commande → Entrée (JSON copié)</li>
            <li>Collez ici → Importer le JSON</li>
          </ol>
          <code className="mt-2 block break-all rounded bg-black/50 p-2 font-mono text-[10px] text-cyan-50">
            {AE_CONSOLE_COPY_SNIPPET}
          </code>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
            onClick={() => void copySnippet()}
          >
            {snippetCopied ? <Check className="mr-1 h-3.5 w-3.5" /> : <ClipboardCopy className="mr-1 h-3.5 w-3.5" />}
            {snippetCopied ? "Copié" : "Copier la commande"}
          </Button>
          <textarea
            className="mt-3 min-h-[72px] w-full rounded-lg border border-cyan-500/30 bg-zinc-950 px-3 py-2 font-mono text-[11px] text-cyan-50"
            placeholder="Collez le JSON ici (Ctrl+V)"
            value={jsonPaste}
            disabled={disabled || busy}
            onChange={(e) => setJsonPaste(e.target.value)}
          />
          <Button
            type="button"
            className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500"
            disabled={disabled || busy || !jsonPaste.trim()}
            onClick={() => void runImport({ aerJson: jsonPaste })}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Importer le JSON
          </Button>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm font-semibold text-white">Option 2 — Fichier HTML</p>
          <p className="mt-1 text-xs text-zinc-400">
            Chrome : Page complète. Si échec → utilisez l’option 1 (le .html ne contient souvent pas les
            SKU).
          </p>
          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-5">
            <FileUp className="h-7 w-7 text-emerald-400" aria-hidden />
            <span className="mt-2 text-xs text-emerald-100">
              {htmlFile ? htmlFile.name : "Fichier .html"}
            </span>
            <input
              type="file"
              accept=".html,.htm,text/html"
              className="sr-only"
              disabled={disabled || busy}
              onChange={(e) => setHtmlFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            type="button"
            className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500"
            disabled={disabled || busy || !htmlFile}
            onClick={() => {
              if (!htmlFile) return
              const form = new FormData()
              form.set("aeUrl", aeUrl.trim())
              form.set("htmlFile", htmlFile)
              void runImport(form)
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer le HTML
          </Button>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">Option 3 — Serveur</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-2 w-full border-white/15 bg-white/10 text-white"
            disabled={disabled || busy}
            onClick={() => void runImport({})}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />}
            API / ScrapingBee
          </Button>
        </div>

        {success ? (
          <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {success}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200">
            {error}
            <br />
            <span className="mt-1 block text-red-300/90">
              → Utilisez <strong>Option 1 JSON</strong> : sur AliExpress, F12, commande copiée, Entrée,
              puis collez ici.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  )
}
