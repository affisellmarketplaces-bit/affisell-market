import type { SupplierVariantFormMode } from "@/lib/supplier-add-product-draft-cache"
import type { ProductVariantLine } from "@/lib/product-variants"
import {
  validateSupplierSkuTableRows,
  type SupplierSkuTableRow,
} from "@/lib/supplier-sku-builder"
import { validateSimpleColorRows } from "@/lib/supplier-simple-color-validation"
import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"

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

const PB = "supplier.publishBlockers"

export function collectClientPublishBlockers(
  ctx: CollectPublishContext,
  locale: AppLocale = "fr"
): PublishBlocker[] {
  const out: PublishBlocker[] = []
  const t = (key: string) => tMessage(locale, `${PB}.${key}`)

  if (!ctx.name.trim()) {
    out.push({ field: "name", message: t("nameRequired") })
  }
  if (ctx.imagesCount === 0) {
    out.push({ field: "images", message: t("imagesRequired") })
  }
  if (!ctx.categoryId.trim()) {
    out.push({ field: "category", message: t("categoryRequired") })
  }
  for (const m of ctx.missingSpecs) {
    out.push({ field: "specs", message: t("specRequired").replace("{label}", m.label) })
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
      message: t("offerModeRequired"),
    })
  }
  const wt = ctx.warehouseType
  if (!wt || (wt !== "local" && wt !== "regional" && wt !== "international")) {
    out.push({
      field: "warehouseType",
      message: t("warehouseTypeRequired"),
    })
  }
  if (!ctx.deliveryCountryCodes?.length) {
    out.push({
      field: "deliveryCountries",
      message: t("deliveryCountriesRequired"),
    })
  }
  if (ctx.variantFormMode === "advanced") {
    const skuRows = ctx.advancedSkuRows ?? []
    const filled = skuRows.filter((r) => r.color.trim())
    if (filled.length === 0) {
      out.push({
        field: "variants",
        message: t("skuVariantRequired"),
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
          message: formatPluralCount(
            tMessage(locale, "supplier.form.skuTableErrors"),
            issues.length
          ),
        })
      }
    }
  }
  if (ctx.variantFormMode === "simple") {
    const filled = ctx.simpleColorRows.filter((r) => r.name.trim())
    if (filled.length === 0) {
      out.push({
        field: "variants",
        message: t("colorRequired"),
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
          message: formatPluralCount(
            tMessage(locale, "supplier.form.simpleColorNameErrorsBlocker"),
            issues.length
          ),
        })
      }
    }
  }

  return out
}

/** Minimal ICU plural resolver for our own ` {count, plural, one {...} other {...}}` messages. */
function formatPluralCount(icuMessage: string, count: number): string {
  const match = icuMessage.match(/\{count,\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/)
  if (!match) return icuMessage.replace(/\{count\}/g, String(count))
  const [, one, other] = match
  const chosen = (count === 1 ? one : other) ?? ""
  return icuMessage.replace(match[0], chosen.replace(/#/g, String(count)))
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

/** Known API error codes → their field + translated display message (routed on the locale-independent code). */
const KNOWN_ERROR_CODES: Record<string, { field: PublishFieldKey; key: string }> = {
  "Invalid variants payload": { field: "variants", key: "invalidVariantsPayload" },
  booking_slots_required: { field: "specs", key: "bookingSlotsRequired" },
  merchant_verification_pending: { field: "specs", key: "merchantVerificationPending" },
  warehouse_type_required: { field: "warehouseType", key: "warehouseTypeRequired" },
  delivery_countries_required: { field: "deliveryCountries", key: "deliveryCountriesRequired" },
  affiliate_commission_required: { field: "commission", key: "affiliateCommissionRequired" },
  product_images_required: { field: "images", key: "productImagesRequiredHosted" },
}

/** Map API 400 responses to field blockers for highlighting. */
export function mapServerPublishBlockers(
  json: {
    error?: string
    errors?: string[]
    issues?: unknown
  },
  locale: AppLocale = "fr"
): PublishBlocker[] {
  const out: PublishBlocker[] = []

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    for (const msg of json.errors) {
      out.push({ field: "specs", message: msg })
    }
  }

  if (typeof json.error === "string" && json.error.trim()) {
    const known = KNOWN_ERROR_CODES[json.error]
    if (known) {
      const message = tMessage(locale, `${PB}.${known.key}`)
      if (!out.some((b) => b.field === known.field && b.message === message)) {
        out.push({ field: known.field, message })
      }
    } else {
      const mapped = blockerFromMessage(json.error)
      if (mapped) {
        if (!out.some((b) => b.field === mapped.field && b.message === mapped.message)) {
          out.push(mapped)
        }
      } else if (out.length === 0) {
        out.push({ field: "specs", message: json.error })
      }
    }
  }

  if (Array.isArray(json.issues) && json.issues.length > 0 && out.length === 0) {
    out.push({
      field: "variants",
      message: tMessage(locale, `${PB}.variantsInvalidGeneric`),
    })
  }

  return out
}

export function uniqueBlockerFields(blockers: PublishBlocker[]): PublishFieldKey[] {
  return [...new Set(blockers.map((b) => b.field))]
}
