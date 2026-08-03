"use client"

import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { AdminVariantImageField } from "@/components/admin/admin-variant-image-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SupplierOption = { id: string; name: string | null; email: string | null }

type AttrRow = { key: string; name: string; value: string }
type VariantRow = {
  key: string
  attrs: AttrRow[]
  wholesaleEur: string
  supplierSku: string
  imageUrl: string
}

function rowKey() {
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function emptyAttr(): AttrRow {
  return { key: rowKey(), name: "", value: "" }
}

function attrsToRecord(rows: AttrRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const n = r.name.trim()
    const v = r.value.trim()
    if (n && v) out[n] = v
  }
  return out
}

function eurToCents(v: string): number {
  const n = Number.parseFloat(v.replace(",", "."))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function pickDefaultSupplierId(suppliers: SupplierOption[]): string {
  const autoBuy = suppliers.find(
    (s) =>
      s.email === "autobuy@affisell.internal" ||
      (s.name ?? "").toLowerCase().includes("autobuy")
  )
  return autoBuy?.id ?? suppliers[0]?.id ?? ""
}

export function AdminProductCreateForm({ suppliers }: { suppliers: SupplierOption[] }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [supplierId, setSupplierId] = useState(() => pickDefaultSupplierId(suppliers))
  const [supplierUrl, setSupplierUrl] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [wholesaleEur, setWholesaleEur] = useState("")
  const [supplierSku, setSupplierSku] = useState("")
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(true)
  const [mappingRows, setMappingRows] = useState<AttrRow[]>([
    { key: rowKey(), name: "Color", value: "" },
    { key: rowKey(), name: "Size", value: "" },
  ])
  const [variants, setVariants] = useState<VariantRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewSrc = useMemo(() => {
    const u = supplierUrl.trim()
    if (!u.includes("aliexpress")) return null
    return u
  }, [supplierUrl])

  const onUrlBlur = useCallback(() => {
    if (supplierUrl.trim().includes("aliexpress")) setShowPreview(true)
  }, [supplierUrl])

  const addMappingRow = () => setMappingRows((r) => [...r, emptyAttr()])
  const removeMappingRow = (key: string) =>
    setMappingRows((r) => (r.length <= 1 ? r : r.filter((x) => x.key !== key)))

  const addVariant = () => {
    setVariants((v) => [
      ...v,
      {
        key: rowKey(),
        attrs: mappingRows.map((m) => ({
          key: rowKey(),
          name: m.name.trim() || "Color",
          value: "",
        })),
        wholesaleEur: wholesaleEur,
        supplierSku: "",
        imageUrl: "",
      },
    ])
  }

  const removeVariant = (key: string) => setVariants((list) => list.filter((v) => v.key !== key))

  const updateVariant = (key: string, patch: Partial<VariantRow>) => {
    setVariants((list) => list.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }

  const save = async () => {
    setError(null)
    setBusy(true)
    try {
      const variantMapping = attrsToRecord(mappingRows)
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          supplierId,
          supplierUrl: supplierUrl.trim(),
          supplierSku: supplierSku.trim() || null,
          wholesalePriceCents: eurToCents(wholesaleEur),
          variantMapping: Object.keys(variantMapping).length ? variantMapping : undefined,
          autoBuyEnabled,
          variants: variants.map((vr) => ({
            attributes: attrsToRecord(vr.attrs),
            wholesalePriceCents: eurToCents(vr.wholesaleEur) || undefined,
            supplierSku: vr.supplierSku.trim() || null,
            imageUrl: vr.imageUrl.trim() || null,
          })),
        }),
      })
      const data = (await res.json()) as { error?: string; product?: { id: string } }
      if (!res.ok) {
        setError(data.error ?? "create_failed")
        return
      }
      if (data.product?.id) {
        router.push(`/admin/products/${data.product.id}`)
      }
    } catch {
      setError("network_error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Produit</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Nom</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">Fournisseur</Label>
          <select
            id="supplier"
            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.email ?? s.id}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplierUrl">URL AliExpress (fournisseur)</Label>
          <Input
            id="supplierUrl"
            value={supplierUrl}
            onChange={(e) => setSupplierUrl(e.target.value)}
            onBlur={onUrlBlur}
            placeholder="https://www.aliexpress.com/item/…"
          />
        </div>
        {showPreview && previewSrc ? (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            <p className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800">
              Aperçu listing AE
            </p>
            <iframe
              title="AliExpress preview"
              src={previewSrc}
              className="h-80 w-full bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wholesale">Prix wholesale HT (€) — défaut</Label>
            <Input
              id="wholesale"
              inputMode="decimal"
              value={wholesaleEur}
              onChange={(e) => setWholesaleEur(e.target.value)}
              placeholder="12.50"
            />
            <p className="text-[11px] text-zinc-500">
              Utilisé si une variante n’a pas de prix propre.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplierSku">SKU AE (manuel, optionnel)</Label>
            <Input
              id="supplierSku"
              value={supplierSku}
              onChange={(e) => setSupplierSku(e.target.value)}
              placeholder="12000001234567890"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300"
            checked={autoBuyEnabled}
            onChange={(e) => setAutoBuyEnabled(e.target.checked)}
          />
          Auto-buy activé
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Mapping variantes AE (clics page produit)</h2>
          <Button type="button" variant="outline" size="sm" onClick={addMappingRow}>
            <Plus className="mr-1 h-3 w-3" /> Attribut
          </Button>
        </div>
        <p className="text-xs text-zinc-500">
          Ex. Color = Black, Size = M — utilisé par le worker pour cliquer les chips AE.
        </p>
        {mappingRows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[8rem] flex-1 space-y-1">
              <Label className="text-xs">Attribut</Label>
              <Input
                value={row.name}
                onChange={(e) =>
                  setMappingRows((rows) =>
                    rows.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r))
                  )
                }
                placeholder="Color"
              />
            </div>
            <div className="min-w-[8rem] flex-1 space-y-1">
              <Label className="text-xs">Valeur</Label>
              <Input
                value={row.value}
                onChange={(e) =>
                  setMappingRows((rows) =>
                    rows.map((r) => (r.key === row.key ? { ...r, value: e.target.value } : r))
                  )
                }
                placeholder="Black"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeMappingRow(row.key)}
              aria-label="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-6 dark:border-violet-900 dark:bg-violet-950/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Variantes Affisell</h2>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              Prix HT et photo par combinaison (couleur / taille). SKU AFF généré à l’enregistrement.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addVariant}>
            <Plus className="mr-1 h-3 w-3" /> Add Variant
          </Button>
        </div>
        {variants.length === 0 ? (
          <p className="rounded-lg border border-dashed border-violet-300/80 bg-white/70 px-4 py-6 text-center text-xs text-zinc-600 dark:border-violet-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            Produit simple : un seul SKU. Cliquez « Add Variant » pour saisir prix + photo par
            couleur.
          </p>
        ) : null}
        {variants.map((vr, index) => (
          <div
            key={vr.key}
            className="space-y-4 rounded-xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Variante {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-red-600"
                onClick={() => removeVariant(vr.key)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Supprimer
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Attributs Affisell</Label>
              {vr.attrs.map((a) => (
                <div key={a.key} className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Attribut (Color)"
                    value={a.name}
                    onChange={(e) =>
                      setVariants((list) =>
                        list.map((v) =>
                          v.key === vr.key
                            ? {
                                ...v,
                                attrs: v.attrs.map((x) =>
                                  x.key === a.key ? { ...x, name: e.target.value } : x
                                ),
                              }
                            : v
                        )
                      )
                    }
                  />
                  <Input
                    className="flex-1"
                    placeholder="Valeur (1 / Rouge…)"
                    value={a.value}
                    onChange={(e) =>
                      setVariants((list) =>
                        list.map((v) =>
                          v.key === vr.key
                            ? {
                                ...v,
                                attrs: v.attrs.map((x) =>
                                  x.key === a.key ? { ...x, value: e.target.value } : x
                                ),
                              }
                            : v
                        )
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Prix wholesale HT (€)</Label>
                <Input
                  inputMode="decimal"
                  placeholder={wholesaleEur || "12.50"}
                  value={vr.wholesaleEur}
                  onChange={(e) => updateVariant(vr.key, { wholesaleEur: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SKU AliExpress (optionnel)</Label>
                <Input
                  placeholder="1200000…"
                  value={vr.supplierSku}
                  onChange={(e) => updateVariant(vr.key, { supplierSku: e.target.value })}
                />
              </div>
            </div>

            <AdminVariantImageField
              value={vr.imageUrl}
              onChange={(imageUrl) => updateVariant(vr.key, { imageUrl })}
              disabled={busy}
              label="Photo de la variante"
            />
          </div>
        ))}
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        type="button"
        disabled={busy || !name.trim() || !supplierUrl.trim()}
        onClick={() => void save()}
      >
        {busy ? "Enregistrement…" : "Save — génère SKU AFF-xxxxx"}
      </Button>
    </div>
  )
}
