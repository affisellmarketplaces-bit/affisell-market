"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2,
  FileUp,
  Loader2,
  Server,
  Sparkles,
  Upload,
} from "lucide-react"

import type { AeCaptureResult } from "@/components/admin/ae-express-import-launcher"
import { Button } from "@/components/ui/button"

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

  const runImport = useCallback(
    async (mode: "auto" | "html") => {
      const url = aeUrl.trim()
      if (!url.includes("aliexpress")) {
        setError("Collez d’abord l’URL AliExpress du produit.")
        return
      }

      setBusy(true)
      setError(null)
      setSuccess(null)

      try {
        let res: Response
        if (mode === "html" && htmlFile) {
          const form = new FormData()
          form.set("aeUrl", url)
          form.set("htmlFile", htmlFile)
          res = await fetch(`/api/admin/products/${productId}/supplier-link/import-catalog`, {
            method: "POST",
            credentials: "include",
            body: form,
          })
        } else {
          res = await fetch(`/api/admin/products/${productId}/supplier-link/import-catalog`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aeUrl: url }),
          })
        }

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

        onCapture({
          resolved: data.resolved,
          suggestions: data.suggestions ?? [],
        })
        onAutoMap?.()

        const n = data.resolved.aeSkus?.length ?? 0
        const src =
          data.source === "api"
            ? "API AliExpress"
            : data.source === "html"
              ? "fichier HTML"
              : data.source === "paste"
                ? "JSON"
                : "serveur"
        setSuccess(`${n} SKU importé(s) via ${src}. Vérifiez le tableau puis Enregistrer.`)
        setHtmlFile(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Échec import"
        setError(
          `${msg} — Si l’import auto échoue : sur AliExpress → Clic droit → « Enregistrer sous » → Page Web complète (.html), puis déposez le fichier ci-dessous.`
        )
      } finally {
        setBusy(false)
      }
    },
    [aeUrl, htmlFile, onAutoMap, onCapture, productId]
  )

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-zinc-950 to-zinc-900 shadow-xl">
      <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Import catalogue · méthode fiable
        </p>
        <h3 className="mt-1 text-lg font-bold text-white">Récupérer les SKU AliExpress</h3>
        <p className="mt-1 text-sm text-emerald-100/70">
          Sans favori ni console : enregistrez la page AE en HTML ou laissez le serveur tenter
          l’API / ScrapingBee.
        </p>
      </div>

      <div className="space-y-4 p-5">
        {diag ? (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                diag.apiConfigured
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              <Server className="h-3 w-3" aria-hidden />
              API AE {diag.apiConfigured ? "OK" : "non configurée"}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                diag.scrapingBeeConfigured
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              ScrapingBee {diag.scrapingBeeConfigured ? "OK" : "absent"}
            </span>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm font-semibold text-white">Option A — Fichier HTML (recommandé)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-zinc-300">
            <li>Ouvrez la fiche produit sur AliExpress (même URL que ci-dessus).</li>
            <li>
              <kbd className="rounded bg-zinc-800 px-1">Clic droit</kbd> →{" "}
              <strong>Enregistrer sous…</strong> → <strong>Page Web, complète</strong> (.html).
            </li>
            <li>Déposez le fichier ici → <strong>Importer le HTML</strong>.</li>
          </ol>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-6 transition hover:bg-emerald-500/10">
            <FileUp className="h-8 w-8 text-emerald-400" aria-hidden />
            <span className="mt-2 text-sm font-medium text-emerald-100">
              {htmlFile ? htmlFile.name : "Choisir le fichier .html"}
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
            className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500"
            disabled={disabled || busy || !htmlFile}
            onClick={() => void runImport("html")}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importer le HTML
          </Button>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">Option B — Serveur (API ou scrape)</p>
          <p className="mt-1 text-xs text-zinc-400">
            Fonctionne si <code className="text-[10px]">ALIEXPRESS_*</code> ou{" "}
            <code className="text-[10px]">SCRAPINGBEE_API_KEY</code> est sur Vercel.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 w-full border-white/15 bg-white/10 text-white hover:bg-white/15"
            disabled={disabled || busy}
            onClick={() => void runImport("auto")}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Importer automatiquement
          </Button>
        </div>

        {success ? (
          <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {success}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
