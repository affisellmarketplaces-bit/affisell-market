"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ExternalLink, Plus, Sparkles, Trash2 } from "lucide-react"

import { AeExpressImportLauncher } from "@/components/admin/ae-express-import-launcher"

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
  if (parts.length > 0) return parts.join(" · ")
  return pv.sku ?? "Variante"
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
      aeSkuId: m.aeSkuId,
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
  const [resolveBusy, setResolveBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aeSkuCatalog, setAeSkuCatalog] = useState<AeProductSkuRow[]>([])
  const [lastSuggestions, setLastSuggestions] = useState<AeSuggestion[]>([])
  const [lastSource, setLastSource] = useState<AeResolveSource | null>(null)
  const searchParams = useSearchParams()

  const productVariants = product.productVariants ?? []
  const hasVariantCatalog = productVariants.length > 0 || variantRows.length > 0

  const resolveFromUrl = useCallback(
    async (opts?: { aerDataPaste?: unknown; aeUrlOverride?: string }) => {
      const url = (opts?.aeUrlOverride ?? form.aeUrl).trim()
      if (!url) return
      setResolveBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/products/${product.id}/resolve-ae-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aeUrl: url,
            ...(opts?.aerDataPaste !== undefined ? { aerDataPaste: opts.aerDataPaste } : {}),
          }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          resolved?: LinkState & {
            aeSkuId: string | null
            aeSkus?: AeProductSkuRow[]
            source?: AeResolveSource
          }
          suggestions?: AeSuggestion[]
          error?: string
        }
        if (!res.ok || !data.ok || !data.resolved) {
          setError(data.error ?? "Import AliExpress impossible")
          return
        }
        setForm((f) => ({
          ...f,
          aeProductId: data.resolved!.aeProductId,
          aeSkuId: data.resolved!.aeSkuId ?? f.aeSkuId,
          aeShopId: data.resolved!.aeShopId || f.aeShopId,
          aePriceCents: data.resolved!.aePriceCents || f.aePriceCents,
          aeShippingCents: data.resolved!.aeShippingCents,
          aeUrl: data.resolved!.aeUrl,
        }))
        if (data.resolved.aeSkus?.length) setAeSkuCatalog(data.resolved.aeSkus)
        if (data.suggestions?.length) setLastSuggestions(data.suggestions)
        setLastSource(data.resolved.source ?? null)
        const skuN = data.resolved.aeSkus?.length ?? 0
        setMessage(
          skuN > 0
            ? `${skuN} SKU importé(s) depuis ${sourceLabel(data.resolved.source)}.`
            : "Product ID rempli — utilisez Import Express."
        )
        if (data.suggestions?.length) {
          setVariantRows((current) => {
            const { rows: next, filled } = applyAeVariantSuggestions(
              current,
              data.suggestions ?? [],
              data.resolved!.aeSkus ?? []
            )
            return filled > 0 ? next : current
          })
        }
      } finally {
        setResolveBusy(false)
      }
    },
    [form.aeUrl, product.id]
  )

  const applyExpressCapture = useCallback(
    async (payload: { aeUrl: string; aerData: unknown }) => {
      await resolveFromUrl({ aerDataPaste: payload.aerData, aeUrlOverride: payload.aeUrl })
    },
    [resolveFromUrl]
  )

  useEffect(() => {
    if (searchParams.get("aeImported") === "1") {
      setMessage("Catalogue AliExpress importé — vérifiez les champs puis enregistrez.")
    }
  }, [searchParams])

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
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Lien fournisseur (AliExpress)</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Import Express : votre navigateur lit la fiche AliExpress et remplit SKU, prix et variantes
        automatiquement — sans API officielle.
      </p>
      {product.affisellSku ? (
        <p className="mt-2 font-mono text-xs text-violet-800 dark:text-violet-200">
          SKU Affisell : {product.affisellSku}
          {product.supplierSku ? ` · AE ${product.supplierSku}` : ""}
        </p>
      ) : null}

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

        <AeExpressImportLauncher
          productId={product.id}
          aeUrl={form.aeUrl}
          disabled={resolveBusy}
          onCapture={applyExpressCapture}
        />

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
                <Button type="button" size="sm" variant="secondary" onClick={autoMapVariants}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Mapper auto
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
                    <th className="pb-2 pr-2 font-medium">Affisell</th>
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
                            className="h-8 min-w-[100px] font-mono text-xs"
                            value={row.aeSkuId}
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
          <Button
            type="button"
            variant="secondary"
            disabled={resolveBusy}
            onClick={() => void resolveFromUrl()}
          >
            {resolveBusy ? "Import…" : "Importer depuis la page AE"}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </section>
  )
}
