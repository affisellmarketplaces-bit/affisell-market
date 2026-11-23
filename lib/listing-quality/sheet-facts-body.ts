/**
 * The 12 sheet elements read from the request body a supplier form is about to SEND, through the same parsers the
 * create / update routes use to STORE it — so what the live sheet check shows is what the sheet-quality measure will
 * read once the sheet is saved (one source of truth, portfolio row 30). Pure, client-safe.
 *
 * Same storage rules as the server: attribute rows via `normalizeProductAttributesFromBody` (empty rows dropped,
 * return window kept only as an extension), stored variants via `parseProductAttributesBody` (`listingVariants` or an
 * object `variants`; an ARRAY of SKU inputs goes to the variant table, which the measure does not read), delivery via
 * `parseDeliveryWindow` (the server stores 2–5 days when none is sent), stock as the route rounds it.
 */
import { sheetSignals, countSpecifications, type SheetSignals } from "@/lib/listing-quality/sheet-facts"
import { parseDeliveryWindow } from "@/lib/supplier-delivery-window"
import { normalizeProductAttributesFromBody, parseProductAttributesBody } from "@/lib/supplier-product-attributes"

export type BodySheetSignals = {
  signals: SheetSignals
  /** Values the server will fill in although the supplier typed nothing (shown as such, never as the supplier's). */
  defaulted: { delivery: boolean }
}

/**
 * `deliveryTypedBySupplier: false` = the form itself put a delivery window in the body (the Express wizard sends 2–7
 * days the supplier never typed): it is stored as sent, and still shown as a default.
 */
export function sheetSignalsFromProductBody(
  body: Record<string, unknown>,
  opts: { deliveryTypedBySupplier?: boolean } = {},
): BodySheetSignals {
  const attributes = normalizeProductAttributesFromBody(body.productAttributes)
  const delivery = parseDeliveryWindow(body)
  const images = Array.isArray(body.images) ? body.images.filter((u): u is string => typeof u === "string" && u.trim() !== "") : []
  const stockRaw = Number(body.stock)
  const signals = sheetSignals({
    name: typeof body.name === "string" ? body.name.trim() : "",
    descriptionHtml: typeof body.description === "string" ? body.description : "",
    imageCount: images.length,
    listingKind: typeof body.listingKind === "string" ? body.listingKind : null,
    stock: Math.max(0, Math.round(Number.isFinite(stockRaw) ? stockRaw : 0)),
    variants: parseProductAttributesBody(body).variants,
    customColumns: body.customColumns ?? null,
    deliveryMin: delivery.deliveryMin,
    deliveryMax: delivery.deliveryMax,
    attributes,
    specCount: countSpecifications(attributes),
  })
  return { signals, defaulted: { delivery: delivery.fromDefault || opts.deliveryTypedBySupplier === false } }
}
