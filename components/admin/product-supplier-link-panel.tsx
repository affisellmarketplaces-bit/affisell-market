"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CloudDownload, ExternalLink, Package, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react"

import { AeExpressImportLauncher, type AeCaptureResult } from "@/components/admin/ae-express-import-launcher"
import { AePasteCatalogPanel } from "@/components/admin/ae-paste-catalog-panel"

import { AffisellPlatformFeesExplainer } from "@/components/shared/affisell-platform-fees-explainer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminProductSupplierLinkRow } from "@/lib/admin/products/load-product-supplier-link"
import {
  applyAeVariantSuggestions,
  type AeVariantMappingRowInput,
} from "@/lib/fulfillment/apply-ae-variant-suggestions"
import type { AeProductSkuRow } from "@/lib/fulfillment/ae-product-skus"
import {
  applySupplierCatalogSkusToMappingRows,
  isValidAeSkuId,
  normalizeAeSkuCandidate,
  resolveDefaultAeSkuFromProduct,
} from "@/lib/fulfillment/map-catalog-skus-to-ae"
import { parseAliExpressProductId } from "@/lib/aliexpress-product-id"

type LinkState = {
  aeUrl: string
  aeProductId: string
  aeSkuId: string
  aeShopId: string
  aePriceCents: number
  aeShippingCents: number
  autoBuyEnabled: boolean
}

type VariantMappingFormRow = AeVariantMappingRowInput

type AeResolveSource = "api" | "page" | "paste"

type AeSuggestion = {
  productVariantId: string
  aeSkuId: string
  matchColor: string | null
  aePriceCents: number
  aeLabel: string
}

function sourceLabel(source?: AeResolveSource): string {
  if (source === "api") return "API AliExpress"
  if (source === "paste") return "JSON collé"
  return "page AE (sans API)"
}

function newRowKey() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function variantLabel(pv: { color: string | null; size: string | null; sku: string | null }) {
  const parts = [pv.color, pv.size].filter(Boolean)
  const base = parts.length > 0 ? parts.join(" · ") : "Variante"
  const ae = pv.sku ? normalizeAeSkuCandidate(pv.sku) : null
  if (ae) return `${base} (SKU AE ${ae.slice(0, 8)}…)`
  if (pv.sku?.trim()) return `${base} · ${pv.sku.trim().slice(0, 24)}`
  return base
}

function initialLink(product: AdminProductSupplierLinkRow): LinkState {
  const sl = product.supplierLink
  return {
    aeUrl: sl?.aeUrl ?? product.sourceUrl ?? "",
    aeProductId: sl?.aeProductId ?? product.aliexpressProductId ?? "",
    aeSkuId: sl?.aeSkuId ?? "",
    aeShopId: sl?.aeShopId ?? "",
    aePriceCents: sl?.aePriceCents ?? 0,
    aeShippingCents: sl?.aeShippingCents ?? 0,
    autoBuyEnabled: sl?.autoBuyEnabled ?? product.autoFulfill,
  }
}

function mappingsFromProduct(product: AdminProductSupplierLinkRow): VariantMappingFormRow[] {
  const existing = product.supplierLink?.variantMappings ?? []
  if (existing.length > 0) {
    return existing.map((m) => ({
      key: m.id,
      productVariantId: m.productVariantId ?? "",
      matchColor: m.matchColor ?? m.productVariant?.color ?? "",
      matchSize: m.matchSize ?? m.productVariant?.size ?? "",
      aeSkuId: normalizeAeSkuCandidate(m.aeSkuId) ?? "",
      aePriceCents: m.aePriceCents,
      aeLabel: m.aeLabel ?? "",
    }))
  }
  const defaultCents = product.supplierLink?.aePriceCents ?? 0
  return (product.productVariants ?? []).map((pv) => ({
    key: newRowKey(),
    productVariantId: pv.id,
    matchColor: pv.color ?? "",
    matchSize: pv.size ?? "",
    aeSkuId: "",
    aePriceCents: defaultCents,
    aeLabel: [pv.color, pv.size].filter(Boolean).join(" · "),
  }))
}

export function ProductSupplierLinkPanel({ product }: { product: AdminProductSupplierLinkRow }) {
  const [form, setForm] = useState<LinkState>(() => initialLink(product))
  const [variantRows, setVariantRows] = useState<VariantMappingFormRow[]>(() =>
    mappingsFromProduct(product)
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aeSkuCatalog, setAeSkuCatalog] = useState<AeProductSkuRow[]>([])
  const [lastSuggestions, setLastSuggestions] = useState<AeSuggestion[]>([])
  const [lastSource, setLastSource] = useState<AeResolveSource | null>(null)
  const searchParams = useSearchParams()

  const productVariants = product.productVariants ?? []
  const hasVariantCatalog = productVariants.length > 0 || variantRows.length > 0

  useEffect(() => {
    const id = parseAliExpressProductId(form.aeUrl)
    if (id && id !== form.aeProductId) {
      setForm((f) => ({ ...f, aeProductId: id }))
    }
  }, [form.aeUrl, form.aeProductId])

  const applyCaptureResult = useCallback((result: AeCaptureResult) => {
    const resolved = result.resolved
    setError(null)
    setForm((f) => ({
      ...f,
      aeProductId: resolved.aeProductId,
      aeSkuId: normalizeAeSkuCandidate(resolved.aeSkuId ?? "") || f.aeSkuId,
      aeShopId: resolved.aeShopId || f.aeShopId,
      aePriceCents: resolved.aePriceCents || f.aePriceCents,
      aeShippingCents: resolved.aeShippingCents,
      aeUrl: resolved.aeUrl || f.aeUrl,
    }))
    if (resolved.aeSkus?.length) setAeSkuCatalog(resolved.aeSkus)
    if (result.suggestions?.length) {
      setLastSuggestions(result.suggestions)
      setVariantRows((current) => {
        const { rows: next } = applyAeVariantSuggestions(
          current,
          result.suggestions,
          resolved.aeSkus ?? []
        )
        return next
      })
    }
    const src = resolved.source
    if (src === "api" || src === "page" || src === "paste") {
      setLastSource(src)
    } else {
      setLastSource("paste")
    }
    const skuN = resolved.aeSkus?.length ?? 0
    setMessage(
      skuN > 0
        ? `${skuN} SKU importé(s) — vérifiez puis enregistrez.`
        : "Import reçu — vérifiez les champs."
    )
  }, [])

  const applyExpressCapture = useCallback(
    (result: AeCaptureResult) => {
      applyCaptureResult(result)
    },
    [applyCaptureResult]
  )

  useEffect(() => {
    if (searchParams.get("aeImported") === "1") {
      setMessage("Catalogue AliExpress importé — vérifiez les champs puis enregistrez.")
    }
  }, [searchParams])

  function mapFromSupplierSkus() {
    const { rows: next, filled, skipped } = applySupplierCatalogSkusToMappingRows(
      variantRows,
      productVariants
    )
    setVariantRows(next)

    const defaultAe = resolveDefaultAeSkuFromProduct(product.supplierSku, productVariants)
    if (defaultAe && !form.aeSkuId.trim()) {
      setForm((f) => ({ ...f, aeSkuId: defaultAe }))
    }

    setError(null)
    if (filled === 0) {
      setError(
        "Aucun SKU AE détecté dans les variantes fournisseur. Le SKU Affisell catalogue ne suffit pas — renseignez le sku_id AliExpress (10–22 chiffres) dans chaque variante côté supplier, ou importez le catalogue AE."
      )
      return
    }
    setMessage(
      `${filled} ligne(s) remplie(s) depuis le catalogue fournisseur${skipped > 0 ? ` · ${skipped} déjà renseignée(s)` : ""}.`
    )
  }

  async function fetchCatalogFromServer() {
    const url = form.aeUrl.trim()
    if (!url.includes("aliexpress") && !form.aeProductId.trim()) {
      setError("URL AliExpress requise.")
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/resolve-ae-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aeUrl: url || `https://www.aliexpress.com/item/${form.aeProductId}.html` }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        resolved?: AeCaptureResult["resolved"]
        suggestions?: AeCaptureResult["suggestions"]
      }
      if (!res.ok || !data.ok || !data.resolved) {
        setError(
          data.error ??
            "Impossible de lire la fiche AE côté serveur — essayez Import Express ou collez le JSON."
        )
        return
      }
      const skuCount = data.resolved.aeSkus?.length ?? 0
      if (skuCount === 0) {
        setError(
          "Aucun SKU AE numérique trouvé sur cette fiche. Utilisez Import Express depuis votre navigateur ou le JSON __AER_DATA__."
        )
        return
      }
      applyCaptureResult({
        resolved: data.resolved,
        suggestions: data.suggestions ?? [],
      })
      setLastSource(data.resolved.source === "api" ? "api" : "page")
      setMessage(
        `${skuCount} SKU AE récupéré(s) (${sourceLabel(data.resolved.source === "api" ? "api" : "page")}). Cliquez « Mapper auto » puis Enregistrer.`
      )
    } finally {
      setBusy(false)
    }
  }

  function clearInvalidAeSkus() {
    let cleared = 0
    setVariantRows((rows) =>
      rows.map((r) => {
        if (r.aeSkuId.trim() && !isValidAeSkuId(r.aeSkuId)) {
          cleared += 1
          return { ...r, aeSkuId: "" }
        }
        return r
      })
    )
    setForm((f) => {
      if (f.aeSkuId.trim() && !isValidAeSkuId(f.aeSkuId)) {
        cleared += 1
        return { ...f, aeSkuId: "" }
      }
      return f
    })
    setMessage(
      cleared > 0
        ? `${cleared} SKU invalide(s) effacé(s) (ex. PID-BLACK) — récupérez le catalogue AE.`
        : "Tous les SKU AE sont déjà au bon format."
    )
    setError(null)
  }

  async function syncViaAliExpressApi() {
    if (!form.aeUrl.trim().includes("aliexpress") && !form.aeProductId.trim()) {
      setError("URL ou Product ID AliExpress requis.")
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/supplier-link/sync-ae-skus`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aeUrl: form.aeUrl }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        resolved?: AeCaptureResult["resolved"]
        aeSkus?: AeProductSkuRow[]
        suggestions?: AeCaptureResult["suggestions"]
      }
      if (!res.ok || !data.ok || !data.resolved) {
        setError(data.error ?? "Sync API impossible — utilisez import express, JSON ou SKU fournisseur.")
        return
      }
      applyCaptureResult({
        resolved: { ...data.resolved, aeSkus: data.aeSkus ?? [] },
        suggestions: data.suggestions ?? [],
      })
      setLastSource("api")
      setMessage("Catalogue récupéré via API AliExpress.")
    } finally {
      setBusy(false)
    }
  }

  function autoMapVariants() {
    if (lastSuggestions.length === 0 && aeSkuCatalog.length === 0) {
      setError("Importez d’abord le catalogue AE (page ou JSON).")
      return
    }
    const suggestions: AeSuggestion[] =
      lastSuggestions.length > 0
        ? lastSuggestions
        : productVariants.flatMap((pv) => {
            const color = pv.color?.trim()
            if (!color) return []
            const ae = aeSkuCatalog.find((s) =>
              s.aeLabel.toLowerCase().includes(color.toLowerCase())
            )
            if (!ae?.aeSkuId) return []
            return [
              {
                productVariantId: pv.id,
                aeSkuId: ae.aeSkuId,
                matchColor: ae.matchColor,
                aePriceCents: ae.aePriceCents,
                aeLabel: ae.aeLabel,
              },
            ]
          })

    const { rows: next, filled, skipped } = applyAeVariantSuggestions(
      variantRows,
      suggestions,
      aeSkuCatalog
    )
    setVariantRows(next)
    setMessage(
      filled > 0
        ? `${filled} variante(s) mappée(s)${skipped > 0 ? ` — ${skipped} déjà remplie(s)` : ""}.`
        : "Aucune ligne vide à remplir — vérifiez les couleurs ou choisissez manuellement."
    )
    setError(null)
  }

  const payloadVariantMappings = useMemo(
    () =>
      variantRows
        .filter((r) => r.aeSkuId.trim())
        .map((r) => ({
          productVariantId: r.productVariantId.trim() || null,
          matchColor: r.matchColor.trim() || null,
          matchSize: r.matchSize.trim() || null,
          aeSkuId: r.aeSkuId.trim(),
          aePriceCents: r.aePriceCents,
          aeLabel: r.aeLabel.trim() || null,
        })),
    [variantRows]
  )

  async function save() {
    const invalidRows = variantRows.filter((r) => r.aeSkuId.trim() && !isValidAeSkuId(r.aeSkuId))
    if (invalidRows.length > 0 || (form.aeSkuId.trim() && !isValidAeSkuId(form.aeSkuId))) {
      setError(
        "SKU AE invalides (ex. PID-BLACK). Effacez-les ou utilisez « Récupérer catalogue (serveur) » pour obtenir les vrais identifiants numériques AliExpress."
      )
      return
    }

    if (
      form.autoBuyEnabled &&
      !form.aeSkuId.trim() &&
      payloadVariantMappings.length === 0
    ) {
      setError(
        "Auto-buy activé : renseignez le SKU par défaut ou mappez au moins une variante."
      )
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/supplier-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aeUrl: form.aeUrl,
          aeProductId: form.aeProductId,
          aeSkuId: form.aeSkuId || null,
          aeShopId: form.aeShopId,
          aePriceCents: form.aePriceCents,
          aeShippingCents: form.aeShippingCents,
          autoBuyEnabled: form.autoBuyEnabled,
          variantMappings: payloadVariantMappings,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible")
        return
      }
      setMessage(
        payloadVariantMappings.length > 0
          ? `Lien enregistré — ${payloadVariantMappings.length} variante(s) mappée(s).`
          : "Lien fournisseur enregistré."
      )
    } finally {
      setBusy(false)
    }
  }

  function addEmptyRow() {
    setVariantRows((rows) => [
      ...rows,
      {
        key: newRowKey(),
        productVariantId: "",
        matchColor: "",
        matchSize: "",
        aeSkuId: "",
        aePriceCents: form.aePriceCents,
        aeLabel: "",
      },
    ])
  }

  function removeRow(key: string) {
    setVariantRows((rows) => rows.filter((r) => r.key !== key))
  }

  function applyAeSkuToRow(rowKey: string, sku: AeProductSkuRow) {
    setVariantRows((rows) =>
      rows.map((r) =>
        r.key === rowKey
          ? {
              ...r,
              aeSkuId: sku.aeSkuId,
              aePriceCents: sku.aePriceCents || r.aePriceCents,
              aeLabel: sku.aeLabel,
              matchColor: r.matchColor || sku.matchColor || "",
              matchSize: r.matchSize || sku.matchSize || "",
            }
          : r
      )
    )
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/80 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/20"
        aria-hidden
      />
      <h2 className="relative text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Lien fournisseur · AliExpress
      </h2>
      <p className="relative mt-1 text-sm text-zinc-500">
        Studio d&apos;import neural : pont navigateur, scrape serveur ou API — SKU AE numériques pour
        l&apos;auto-buy.
      </p>
      <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <strong>SKU Affisell</strong> ({product.affisellSku ?? "—"}) = référence catalogue interne.{" "}
        <strong>SKU AE</strong> = identifiant numérique AliExpress (auto-buy). Si le fournisseur a saisi le{" "}
        <code className="rounded bg-amber-100/80 px-1 text-[10px] dark:bg-amber-900/50">sku_id</code> AE dans
        chaque variante, utilisez <strong>SKU fournisseur → AE</strong> sans le favori.
      </div>

      <AffisellPlatformFeesExplainer
        className="mt-4"
        variant="product"
        highlightAutoBuy={form.autoBuyEnabled}
      />

      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="aeUrl">URL AliExpress</Label>
          <Input
            id="aeUrl"
            className="mt-1"
            value={form.aeUrl}
            onChange={(e) => setForm((f) => ({ ...f, aeUrl: e.target.value }))}
            placeholder="https://www.aliexpress.com/item/…"
          />
          {lastSource ? (
            <p className="mt-1 text-[11px] text-zinc-500">
              Dernier import : {sourceLabel(lastSource)}
            </p>
          ) : null}
        </div>

        <AePasteCatalogPanel
          productId={product.id}
          aeUrl={form.aeUrl}
          disabled={busy}
          onCapture={applyCaptureResult}
        />

        <AeExpressImportLauncher
          productId={product.id}
          aeUrl={form.aeUrl}
          disabled={busy}
          onCapture={applyExpressCapture}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="border-0 bg-violet-600 text-white hover:bg-violet-700"
            disabled={busy}
            onClick={() => void fetchCatalogFromServer()}
          >
            <CloudDownload className="mr-1 h-3.5 w-3.5" />
            Récupérer catalogue (serveur)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || productVariants.length === 0}
            onClick={mapFromSupplierSkus}
          >
            <Package className="mr-1 h-3.5 w-3.5" />
            SKU fournisseur (si numériques)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void syncViaAliExpressApi()}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Sync API
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={clearInvalidAeSkus}>
            Effacer SKU invalides
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Product ID</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={form.aeProductId}
              onChange={(e) => setForm((f) => ({ ...f, aeProductId: e.target.value }))}
            />
          </div>
          <div>
            <Label>SKU par défaut (sans variante)</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={form.aeSkuId}
              onChange={(e) => setForm((f) => ({ ...f, aeSkuId: e.target.value }))}
            />
          </div>
          <div>
            <Label>Shop ID</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={form.aeShopId}
              onChange={(e) => setForm((f) => ({ ...f, aeShopId: e.target.value }))}
            />
          </div>
          <div>
            <Label>Prix achat défaut (centimes)</Label>
            <Input
              type="number"
              className="mt-1"
              value={form.aePriceCents}
              onChange={(e) =>
                setForm((f) => ({ ...f, aePriceCents: Math.max(0, Number(e.target.value) || 0) }))
              }
            />
          </div>
        </div>

        {hasVariantCatalog ? (
          <div className="space-y-3 rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Variantes → SKU AliExpress
                </h3>
                <p className="text-xs text-zinc-500">
                  Une ligne par couleur (ou variante). Prix en centimes — utilisé pour la carte virtuelle.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={mapFromSupplierSkus}>
                  <Package className="mr-1 h-3.5 w-3.5" />
                  SKU fournisseur
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={autoMapVariants}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Mapper auto (couleurs)
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={addEmptyRow}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Ligne
                </Button>
              </div>
            </div>

            {aeSkuCatalog.length > 0 ? (
              <p className="text-[11px] text-violet-800 dark:text-violet-200">
                Catalogue AE : {aeSkuCatalog.map((s) => s.aeLabel).join(" · ")}
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                    <th className="pb-2 pr-2 font-medium">Variante</th>
                    <th className="pb-2 pr-2 font-medium">SKU fourn.</th>
                    <th className="pb-2 pr-2 font-medium">Couleur</th>
                    <th className="pb-2 pr-2 font-medium">SKU AE</th>
                    <th className="pb-2 pr-2 font-medium">Prix (¢)</th>
                    <th className="pb-2 font-medium">Libellé AE</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {variantRows.map((row) => (
                    <tr key={row.key} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-2">
                        <select
                          className="w-full max-w-[140px] rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                          value={row.productVariantId}
                          onChange={(e) => {
                            const id = e.target.value
                            const pv = productVariants.find((v) => v.id === id)
                            setVariantRows((rows) =>
                              rows.map((r) =>
                                r.key === row.key
                                  ? {
                                      ...r,
                                      productVariantId: id,
                                      matchColor: pv?.color ?? r.matchColor,
                                      matchSize: pv?.size ?? r.matchSize,
                                    }
                                  : r
                              )
                            )
                          }}
                        >
                          <option value="">—</option>
                          {productVariants.map((pv) => (
                            <option key={pv.id} value={pv.id}>
                              {variantLabel(pv)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2 font-mono text-[10px] text-zinc-500">
                        {(() => {
                          const pv = productVariants.find(
                            (v) => v.id === row.productVariantId
                          )
                          const raw = pv?.sku?.trim()
                          if (!raw) return "—"
                          const ae = normalizeAeSkuCandidate(raw)
                          return ae ? `✓ ${ae.slice(0, 10)}…` : raw.slice(0, 14)
                        })()}
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-8 text-xs"
                          value={row.matchColor}
                          placeholder="green"
                          onChange={(e) =>
                            setVariantRows((rows) =>
                              rows.map((r) =>
                                r.key === row.key ? { ...r, matchColor: e.target.value } : r
                              )
                            )
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex gap-1">
                          <Input
                            className={`h-8 min-w-[100px] font-mono text-xs ${
                              row.aeSkuId.trim() && !isValidAeSkuId(row.aeSkuId)
                                ? "border-red-500 ring-1 ring-red-400"
                                : ""
                            }`}
                            value={row.aeSkuId}
                            placeholder="120000…"
                            onChange={(e) =>
                              setVariantRows((rows) =>
                                rows.map((r) =>
                                  r.key === row.key ? { ...r, aeSkuId: e.target.value } : r
                                )
                              )
                            }
                          />
                          {aeSkuCatalog.length > 0 ? (
                            <select
                              className="max-w-[88px] rounded-md border border-zinc-200 bg-white px-1 text-[10px] dark:border-zinc-700 dark:bg-zinc-950"
                              value=""
                              onChange={(e) => {
                                const sku = aeSkuCatalog.find((s) => s.aeSkuId === e.target.value)
                                if (sku) applyAeSkuToRow(row.key, sku)
                              }}
                              aria-label="Choisir SKU catalogue"
                            >
                              <option value="">▼</option>
                              {aeSkuCatalog
                                .filter((s) => s.aeSkuId)
                                .map((s) => (
                                  <option key={s.aeSkuId} value={s.aeSkuId}>
                                    {s.aeLabel.slice(0, 12)}
                                  </option>
                                ))}
                            </select>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          className="h-8 w-20 text-xs"
                          value={row.aePriceCents}
                          onChange={(e) =>
                            setVariantRows((rows) =>
                              rows.map((r) =>
                                r.key === row.key
                                  ? { ...r, aePriceCents: Math.max(0, Number(e.target.value) || 0) }
                                  : r
                              )
                            )
                          }
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-8 text-xs"
                          value={row.aeLabel}
                          onChange={(e) =>
                            setVariantRows((rows) =>
                              rows.map((r) =>
                                r.key === row.key ? { ...r, aeLabel: e.target.value } : r
                              )
                            )
                          }
                        />
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                          onClick={() => removeRow(row.key)}
                          aria-label="Supprimer la ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {variantRows.length === 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Aucune variante mappée — l’auto-buy utilisera le SKU par défaut (risque de mauvaise couleur).
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Produit sans lignes <code className="text-[11px]">ProductVariant</code> — saisissez le SKU AE par défaut
            et le mapping variantes sur la fiche produit (création admin).
          </p>
        )}

        <div className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium">Auto-Buy activé</p>
            <p className="text-xs text-zinc-500">Désactivé si DISABLE_AUTO_BUY=true côté serveur</p>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-zinc-300"
            checked={form.autoBuyEnabled}
            onChange={(e) => setForm((f) => ({ ...f, autoBuyEnabled: e.target.checked }))}
            aria-label="Auto-Buy activé"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => window.open(form.aeUrl, "_blank")}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Tester le lien
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </section>
  )
}
