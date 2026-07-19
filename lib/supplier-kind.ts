export type SupplierKind = "unset" | "producer" | "stocker"

/** Radar cockpit mode derived from supplier sub-type. */
export type RadarCockpit = "defense" | "attaque"

/** User-facing display slug (DB value stays `stocker`). */
export type SupplierKindDisplaySlug = "producteur" | "grossiste" | "unset"

type SupplierKindCarrier = {
  supplierKind?: string | null
}

const LABELS: Record<SupplierKind, string> = {
  unset: "Non défini",
  producer: "Producteur",
  /** DB enum stays `stocker` — UI wording is Grossiste (B2B). */
  stocker: "Grossiste",
}

/** Zod / API set values (onboarding never writes "unset"). */
export const SUPPLIER_KIND_SET_VALUES = ["producer", "stocker"] as const
export type SupplierKindSetValue = (typeof SUPPLIER_KIND_SET_VALUES)[number]

export function parseSupplierKind(raw: unknown): SupplierKind {
  if (raw === "producer" || raw === "stocker" || raw === "unset") return raw
  // UI alias — never persist "grossiste"; DB stays stocker
  if (raw === "grossiste") return "stocker"
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

/** Analytics / copy slug — never rename DB `stocker`. */
export function getSupplierKindDisplaySlug(
  kind: string | null | undefined
): SupplierKindDisplaySlug {
  const k = parseSupplierKind(kind)
  if (k === "producer") return "producteur"
  if (k === "stocker") return "grossiste"
  return "unset"
}

/** PostHog-safe props: keep `kind=stocker` for funnels, add display_kind. */
export function getSupplierKindAnalyticsProps(kind: string | null | undefined): {
  kind: SupplierKind
  display_kind: SupplierKindDisplaySlug
} {
  const k = parseSupplierKind(kind)
  return { kind: k, display_kind: getSupplierKindDisplaySlug(k) }
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
