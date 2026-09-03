import { isDropForgeImportComplete } from "@/lib/dropforge-complete-import"

/** Client-safe — audit gaps on a DropForge preview (no re-import). */
export type DropForgePreviewGap = {
  id: DropForgeRefineQuickAction
  label: string
  severity: "blocker" | "warning" | "nice"
  hint: string
}

export type DropForgeRefineQuickAction =
  | "images"
  | "description"
  | "variants"
  | "specs"
  | "category"
  | "brand"
  | "title"
  | "cost"

export const DROPFORGE_REFINE_QUICK_ACTIONS: DropForgeRefineQuickAction[] = [
  "images",
  "description",
  "variants",
  "specs",
  "category",
  "brand",
  "title",
  "cost",
]

export type DropForgeRefinePreviewInput = {
  title?: string
  description?: string
  images?: string[]
  videos?: string[]
  variants?: unknown[]
  colors?: unknown[]
  sizes?: string[]
  specs?: Record<string, string>
  costPrice?: number
  brand?: string
  category?: string
  categoryId?: string
  tags?: string[]
  warnings?: string[]
}

export function auditDropForgePreview(p: DropForgeRefinePreviewInput): DropForgePreviewGap[] {
  const gaps: DropForgePreviewGap[] = []

  if (!p.title?.trim() || p.title.trim().length < 3) {
    gaps.push({
      id: "title",
      label: "Titre",
      severity: "blocker",
      hint: "Titre commercial manquant ou trop court.",
    })
  }

  if (!p.description?.trim() || p.description.trim().length < 40) {
    gaps.push({
      id: "description",
      label: "Description",
      severity: "blocker",
      hint: "Description trop courte pour publier au catalogue.",
    })
  }

  const imageCount = p.images?.length ?? 0
  if (imageCount < 1) {
    gaps.push({
      id: "images",
      label: "Images",
      severity: "blocker",
      hint: "Aucune image — ajoutez la galerie ou demandez un complément API.",
    })
  } else if (imageCount < 3) {
    gaps.push({
      id: "images",
      label: "Galerie",
      severity: "warning",
      hint: `Seulement ${imageCount} image(s) — une galerie complète convertit mieux.`,
    })
  }

  if (!p.costPrice || p.costPrice <= 0 || !Number.isFinite(p.costPrice)) {
    gaps.push({
      id: "cost",
      label: "Prix source",
      severity: "blocker",
      hint: "Coût fournisseur manquant.",
    })
  }

  const variantCount = p.variants?.length ?? 0
  const colorCount = p.colors?.length ?? 0
  if (variantCount < 2 && colorCount < 2) {
    gaps.push({
      id: "variants",
      label: "Variantes",
      severity: "warning",
      hint: "Peu ou pas de variantes couleur/taille — précisez ce qui manque.",
    })
  }

  const specCount = Object.keys(p.specs ?? {}).filter((k) => p.specs?.[k]?.trim()).length
  if (specCount < 3) {
    gaps.push({
      id: "specs",
      label: "Caractéristiques",
      severity: "warning",
      hint: "Specs techniques insuffisantes pour les resellers.",
    })
  }

  if (!p.categoryId && !(p.category?.trim() && p.category.trim().length > 2)) {
    gaps.push({
      id: "category",
      label: "Catégorie",
      severity: "warning",
      hint: "Catégorie non assignée — requis pour publier live.",
    })
  }

  if (!p.brand?.trim() || /^generic$/i.test(p.brand.trim())) {
    gaps.push({
      id: "brand",
      label: "Marque",
      severity: "nice",
      hint: "Marque générique — précisez si vous connaissez la marque réelle.",
    })
  }

  return gaps
}

export function isDropForgePreviewPublishable(p: DropForgeRefinePreviewInput): boolean {
  return isDropForgeImportComplete({
    title: p.title ?? "",
    description: p.description ?? p.title ?? "",
    images: p.images ?? [],
    costPrice: p.costPrice ?? 0,
  })
}

export function dropForgeRefineQuickPrompt(
  action: DropForgeRefineQuickAction,
  locale: "fr" | "en" = "fr"
): string {
  const fr: Record<DropForgeRefineQuickAction, string> = {
    images:
      "Complète la galerie images manquante depuis la source AliExpress (sans tout réimporter).",
    description:
      "Rédige une description commerciale complète en français, factuelle, sans inventer de garanties.",
    variants: "Ajoute les variantes couleur/taille manquantes visibles sur la fiche source.",
    specs: "Ajoute les caractéristiques techniques manquantes (matière, dimensions, etc.) en français.",
    category: "Propose une catégorie e-commerce pertinente pour ce produit (breadcrumb FR).",
    brand: "Identifie ou confirme la marque réelle du produit.",
    title: "Optimise le titre en français pour le SEO marketplace (max 120 caractères).",
    cost: "Vérifie et corrige le coût source EUR si incohérent avec les variantes.",
  }
  const en: Record<DropForgeRefineQuickAction, string> = {
    images: "Fill in missing product gallery images from the AliExpress source (no full re-import).",
    description: "Write a complete French commercial description — factual, no fake warranties.",
    variants: "Add missing color/size variants from the source listing.",
    specs: "Add missing technical specs (material, dimensions, etc.) in French.",
    category: "Suggest a relevant e-commerce category breadcrumb in French.",
    brand: "Identify or confirm the real product brand.",
    title: "Optimize the French marketplace SEO title (max 120 chars).",
    cost: "Verify and fix source EUR cost if inconsistent with variants.",
  }
  return (locale === "en" ? en : fr)[action]
}
