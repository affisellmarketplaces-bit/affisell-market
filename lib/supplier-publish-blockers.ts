import type { SupplierVariantFormMode } from "@/lib/supplier-add-product-draft-cache"
import type { ProductVariantLine } from "@/lib/product-variants"
import {
  validateSupplierSkuTableRows,
  type SupplierSkuTableRow,
} from "@/lib/supplier-sku-builder"
import { validateSimpleColorRows } from "@/lib/supplier-simple-color-validation"

export type PublishFieldKey =
  | "name"
  | "images"
  | "category"
  | "specs"
  | "price"
  | "compareAt"
  | "commission"
  | "variants"
  | "offerMode"
  | "warehouseType"
  | "deliveryCountries"

export type PublishBlocker = {
  field: PublishFieldKey
  message: string
}

export const PUBLISH_FIELD_SCROLL_ID: Record<PublishFieldKey, string> = {
  name: "p-name",
  images: "add-product-media",
  category: "add-product-classify",
  specs: "product-spec-fields",
  price: "add-product-pricing",
  compareAt: "p-compare",
  commission: "add-product-commission",
  variants: "add-product-variants",
  offerMode: "add-product-offer-mode",
  warehouseType: "add-product-shipping-zone",
  deliveryCountries: "add-product-delivery-countries",
}

export function publishBlockerStep(field: PublishFieldKey): 1 | 2 | 3 {
  if (field === "name" || field === "images" || field === "category" || field === "specs") {
    return 1
  }
  if (field === "price" || field === "compareAt" || field === "variants") {
    return 2
  }
  return 3
}

export const PUBLISH_SECTION_ERROR_CLASS =
  "border-red-400 ring-2 ring-red-500/45 dark:border-red-500/80 dark:ring-red-500/35"

export const PUBLISH_INPUT_ERROR_CLASS =
  "border-red-500 ring-2 ring-red-500/25 focus:border-red-500 focus-visible:ring-red-500/30 dark:border-red-500"

export type CollectPublishContext = {
  name: string
  imagesCount: number
  categoryId: string
  missingSpecs: { label: string; key?: string }[]
  priceError: string | null
  compareError: string | null
  commissionError: string | null
  variantFormMode: SupplierVariantFormMode
  variantRows: ProductVariantLine[]
  advancedSkuRows?: SupplierSkuTableRow[]
  simpleColorRows: { name: string }[]
  offerModeAcknowledged?: boolean
  warehouseType?: "" | "local" | "regional" | "international"
  deliveryCountryCodes?: string[]
}

export function collectClientPublishBlockers(ctx: CollectPublishContext): PublishBlocker[] {
  const out: PublishBlocker[] = []

  if (!ctx.name.trim()) {
    out.push({ field: "name", message: "Le titre du produit est obligatoire." })
  }
  if (ctx.imagesCount === 0) {
    out.push({ field: "images", message: "Ajoutez au moins une photo produit." })
  }
  if (!ctx.categoryId.trim()) {
    out.push({ field: "category", message: "Sélectionnez une catégorie." })
  }
  for (const m of ctx.missingSpecs) {
    out.push({ field: "specs", message: `${m.label} est requis` })
  }
  if (ctx.priceError) {
    out.push({ field: "price", message: ctx.priceError })
  }
  if (ctx.compareError) {
    out.push({ field: "compareAt", message: ctx.compareError })
  }
  if (ctx.commissionError) {
    out.push({ field: "commission", message: ctx.commissionError })
  }
  if (ctx.offerModeAcknowledged === false) {
    out.push({
      field: "offerMode",
      message:
        "Indiquez l'état du produit (neuf, reconditionné, seconde main, gros ou don) — champ obligatoire.",
    })
  }
  const wt = ctx.warehouseType
  if (!wt || (wt !== "local" && wt !== "regional" && wt !== "international")) {
    out.push({
      field: "warehouseType",
      message:
        "Indiquez la zone logistique (local, régional ou international) — obligatoire pour la publication.",
    })
  }
  if (!ctx.deliveryCountryCodes?.length) {
    out.push({
      field: "deliveryCountries",
      message:
        "Sélectionnez au moins un pays de livraison (ou « Monde entier ») — obligatoire pour la publication.",
    })
  }
  if (ctx.variantFormMode === "advanced") {
    const skuRows = ctx.advancedSkuRows ?? []
    const filled = skuRows.filter((r) => r.color.trim())
    if (filled.length === 0) {
      out.push({
        field: "variants",
        message:
          "Ajoutez au moins une variante SKU (mode rapide ou ligne du tableau), ou repassez en produit simple.",
      })
    } else {
      const issues = validateSupplierSkuTableRows(filled, [], { requirePositiveCommission: true })
      const uniqueMessages = [...new Set(issues.map((i) => i.message))].slice(0, 3)
      for (const message of uniqueMessages) {
        out.push({ field: "variants", message })
      }
      if (issues.length > uniqueMessages.length) {
        out.push({
          field: "variants",
          message: `${issues.length} erreurs à corriger dans le tableau SKU.`,
        })
      }
    }
  }
  if (ctx.variantFormMode === "simple") {
    const filled = ctx.simpleColorRows.filter((r) => r.name.trim())
    if (filled.length === 0) {
      out.push({
        field: "variants",
        message: "Ajoutez au moins une couleur, ou repassez en produit simple.",
      })
    } else {
      const issues = validateSimpleColorRows(ctx.simpleColorRows)
      const uniqueMessages = [...new Set(issues.map((i) => i.message))].slice(0, 3)
      for (const message of uniqueMessages) {
        out.push({ field: "variants", message })
      }
      if (issues.length > uniqueMessages.length) {
        out.push({
          field: "variants",
          message: `${issues.length} erreurs sur les noms de couleur.`,
        })
      }
    }
  }

  return out
}

function blockerFromMessage(message: string): PublishBlocker | null {
  const m = message.toLowerCase()
  if (m.includes("prix") || m.includes("price") || m.includes("compare")) {
    if (m.includes("compare") || m.includes("barré") || m.includes("compare-at")) {
      return { field: "compareAt", message }
    }
    return { field: "price", message }
  }
  if (m.includes("commission")) return { field: "commission", message }
  if (m.includes("wholesale_moq") || m.includes("offer_mode") || m.includes("état du produit")) {
    return { field: "offerMode", message }
  }
  if (m.includes("warehouse_type") || m.includes("zone logistique")) {
    return { field: "warehouseType", message }
  }
  if (m.includes("delivery_countries") || m.includes("pays de livraison")) {
    return { field: "deliveryCountries", message }
  }
  if (m.includes("variant") || m.includes("sku") || m.includes("déclinaison")) {
    return { field: "variants", message }
  }
  if (m.includes("digital_access") || m.includes("accès digital") || m.includes("digital access")) {
    return { field: "specs", message }
  }
  if (
    m.includes("booking_slots") ||
    m.includes("créneau") ||
    m.includes("creneau") ||
    m.includes("appointment slot")
  ) {
    return { field: "specs", message }
  }
  if (m.includes("catégor") || m.includes("category")) return { field: "category", message }
  if (m.includes("image") || m.includes("photo")) return { field: "images", message }
  if (m.includes("titre") || m.includes("name") || m.includes("nom")) return { field: "name", message }
  return null
}

/** Map API 400 responses to field blockers for highlighting. */
export function mapServerPublishBlockers(json: {
  error?: string
  errors?: string[]
  issues?: unknown
}): PublishBlocker[] {
  const out: PublishBlocker[] = []

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    for (const msg of json.errors) {
      out.push({ field: "specs", message: msg })
    }
  }

  if (typeof json.error === "string" && json.error.trim()) {
    const normalizedError =
      json.error === "Invalid variants payload"
        ? "Format des variantes incorrect : en mode couleurs, n’utilisez pas la clé SKU ; en mode tableau SKU, vérifiez chaque ligne."
        : json.error === "booking_slots_required"
          ? "Ajoutez au moins un créneau de rendez-vous futur avant de publier (Booking Hub)."
          : json.error === "merchant_verification_pending"
            ? "Vérification marchand requise — complétez votre dossier KYC sur /dashboard/verification avant de publier."
            : json.error === "warehouse_type_required"
              ? "Indiquez la zone logistique (local, régional ou international) — obligatoire pour la publication."
              : json.error === "delivery_countries_required"
                ? "Sélectionnez au moins un pays de livraison (ou « Monde entier ») — obligatoire pour la publication."
              : json.error === "affiliate_commission_required"
                ? "Définissez la commission offerte aux affiliés sur chaque vente (> 0 %). La grille catégorie est indicative uniquement."
              : json.error === "product_images_required"
                ? "Ajoutez au moins une photo produit hébergée (upload terminé) avant de publier."
              : json.error
    const mapped = blockerFromMessage(normalizedError)
    if (mapped) {
      if (!out.some((b) => b.field === mapped.field && b.message === mapped.message)) {
        out.push({ ...mapped, message: normalizedError })
      }
    } else if (out.length === 0) {
      out.push({ field: "specs", message: normalizedError })
    }
  }

  if (Array.isArray(json.issues) && json.issues.length > 0 && out.length === 0) {
    out.push({
      field: "variants",
      message: "Corrigez les variantes / lignes SKU (champs invalides).",
    })
  }

  return out
}

export function uniqueBlockerFields(blockers: PublishBlocker[]): PublishFieldKey[] {
  return [...new Set(blockers.map((b) => b.field))]
}
