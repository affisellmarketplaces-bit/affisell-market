export type SupplierKind = "unset" | "producer" | "stocker"

/** Radar cockpit mode derived from supplier sub-type. */
export type RadarCockpit = "defense" | "attaque"

type SupplierKindCarrier = {
  supplierKind?: string | null
}

const LABELS: Record<SupplierKind, string> = {
  unset: "Non défini",
  producer: "Producteur",
  stocker: "Stockeur",
}

/** Zod / API set values (onboarding never writes "unset"). */
export const SUPPLIER_KIND_SET_VALUES = ["producer", "stocker"] as const
export type SupplierKindSetValue = (typeof SUPPLIER_KIND_SET_VALUES)[number]

export function parseSupplierKind(raw: unknown): SupplierKind {
  if (raw === "producer" || raw === "stocker" || raw === "unset") return raw
  return "unset"
}

export function isProducer(u: SupplierKindCarrier): boolean {
  return parseSupplierKind(u.supplierKind) === "producer"
}

export function isStocker(u: SupplierKindCarrier): boolean {
  return parseSupplierKind(u.supplierKind) === "stocker"
}

export function getSupplierKindLabel(kind: string | null | undefined): string {
  return LABELS[parseSupplierKind(kind)]
}

export function getRadarCockpit(kind: string | null | undefined): RadarCockpit | null {
  const k = parseSupplierKind(kind)
  if (k === "producer") return "defense"
  if (k === "stocker") return "attaque"
  return null
}

export function needsSupplierKindOnboarding(kind: string | null | undefined): boolean {
  return parseSupplierKind(kind) === "unset"
}
