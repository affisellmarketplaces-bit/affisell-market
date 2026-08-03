"use client"

import { useCallback, useMemo, useState } from "react"
import { ImagePlus, Loader2, Save, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { AdminVariantImageField } from "@/components/admin/admin-variant-image-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  findColorImageRowForName,
  parseProductColorImagesFromDb,
} from "@/lib/product-color-images"
import { cn } from "@/lib/utils"

export type AdminVariantEditorRow = {
  id: string
  color: string | null
  size: string | null
  sku: string | null
  wholesalePriceCents: number | null
  stock: number
  customData: unknown
}

type Draft = {
  color: string
  size: string
  wholesaleEur: string
  stock: string
  imageUrl: string
}

function readCustomImage(customData: unknown): string {
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) return ""
  const img = (customData as Record<string, unknown>).image
  return typeof img === "string" ? img.trim() : ""
}

function centsToEur(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return ""
  return (cents / 100).toFixed(2)
}

function buildDrafts(
  variants: AdminVariantEditorRow[],
  colorImagesJson: unknown
): Record<string, Draft> {
  const colorImages = parseProductColorImagesFromDb(colorImagesJson) ?? []
  const out: Record<string, Draft> = {}
  for (const v of variants) {
    const color = (v.color ?? "").trim()
    const fromCustom = readCustomImage(v.customData)
    const fromColor = color
      ? findColorImageRowForName(colorImages, color)?.image?.trim() || ""
      : ""
    out[v.id] = {
      color,
      size: (v.size ?? "").trim(),
      wholesaleEur: centsToEur(v.wholesalePriceCents),
      stock: String(Math.max(0, v.stock)),
      imageUrl: fromCustom || fromColor,
    }
  }
  return out
}

type Props = {
  productId: string
  variants: AdminVariantEditorRow[]
  colorImages: unknown
}

/**
 * AutoBuy / admin — edit each SKU: label, wholesale, stock, photo.
 * Saves via PATCH /api/admin/products/[id]/variants (colorImages source of truth).
 */
export function AdminProductVariantsEditor({ productId, variants, colorImages }: Props) {
  const [drafts, setDrafts] = useState(() => buildDrafts(variants, colorImages))
  const [busy, setBusy] = useState(false)

  const missingPhotoCount = useMemo(
    () => Object.values(drafts).filter((d) => !d.imageUrl.trim()).length,
    [drafts]
  )

  const patchDraft = useCallback((id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      return { ...prev, [id]: { ...cur, ...patch } }
    })
  }, [])

  const save = useCallback(async () => {
    setBusy(true)
    try {
      const payload = variants.map((v) => {
        const d = drafts[v.id]
        const wholesale = Number.parseFloat((d?.wholesaleEur ?? "").replace(",", "."))
        const stock = Number.parseInt(d?.stock ?? "0", 10)
        return {
          id: v.id,
          color: d?.color ?? "",
          size: d?.size?.trim() ? d.size.trim() : null,
          wholesalePriceCents:
            Number.isFinite(wholesale) && wholesale >= 0 ? Math.round(wholesale * 100) : undefined,
          stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
          imageUrl: d?.imageUrl ?? "",
        }
      })

      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/variants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ variants: payload }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string; changed?: boolean }
      if (!res.ok || !body.ok) {
        toast.error(
          body.error === "duplicate_color_size"
            ? "Doublon couleur × taille — renomme une variante"
            : body.error || "Enregistrement impossible"
        )
        return
      }
      toast.success(body.changed ? "Variantes mises à jour" : "Déjà à jour")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(false)
    }
  }, [drafts, productId, variants])

  if (variants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        Aucune variante SKU — produit simple. Utilise Instant Enlist avec une fiche multi-SKU pour
        générer la matrice.
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/80 via-white to-cyan-50/50 p-5 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-zinc-950 dark:to-cyan-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Variantes éditables
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Prix, stock & photo par SKU
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Complète les photos manquantes (AE n’en fournit pas toujours). Les revendeurs voient ces
            visuels sur la fiche et au checkout — source de vérité{" "}
            <code className="text-[10px]">colorImages</code>.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {missingPhotoCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
              {missingPhotoCount} sans photo
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              Toutes les photos OK
            </span>
          )}
          <Button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="gap-2 rounded-full bg-violet-600 hover:bg-violet-700"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            Enregistrer les variantes
          </Button>
        </div>
      </div>

      <ul className="space-y-3">
        {variants.map((v) => {
          const d = drafts[v.id]
          if (!d) return null
          const missing = !d.imageUrl.trim()
          return (
            <li
              key={v.id}
              className={cn(
                "rounded-xl border bg-white/90 p-4 shadow-sm dark:bg-zinc-950/70",
                missing
                  ? "border-amber-300/80 ring-1 ring-amber-200/60 dark:border-amber-800/50"
                  : "border-zinc-200 dark:border-zinc-800"
              )}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {(d.color || "Variante") + (d.size ? ` · ${d.size}` : "")}
                </span>
                {v.sku ? (
                  <span className="font-mono text-[10px] text-zinc-500">{v.sku.slice(0, 28)}</span>
                ) : null}
                {missing ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <ImagePlus className="h-3 w-3" aria-hidden />
                    Photo manquante
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Couleur / libellé
                    </Label>
                    <Input
                      value={d.color}
                      disabled={busy}
                      onChange={(e) => patchDraft(v.id, { color: e.target.value })}
                      className="mt-1"
                      placeholder="Noir, Rouge…"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Taille
                    </Label>
                    <Input
                      value={d.size}
                      disabled={busy}
                      onChange={(e) => patchDraft(v.id, { size: e.target.value })}
                      className="mt-1"
                      placeholder="optionnel"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-1 sm:grid-cols-1 sm:gap-3 lg:col-span-1">
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Wholesale €
                      </Label>
                      <Input
                        value={d.wholesaleEur}
                        disabled={busy}
                        inputMode="decimal"
                        onChange={(e) => patchDraft(v.id, { wholesaleEur: e.target.value })}
                        className="mt-1 tabular-nums"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Stock
                      </Label>
                      <Input
                        value={d.stock}
                        disabled={busy}
                        inputMode="numeric"
                        onChange={(e) => patchDraft(v.id, { stock: e.target.value })}
                        className="mt-1 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
                <AdminVariantImageField
                  value={d.imageUrl}
                  disabled={busy}
                  label={missing ? "Ajouter une photo" : "Photo variante"}
                  onChange={(image) => patchDraft(v.id, { imageUrl: image })}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
