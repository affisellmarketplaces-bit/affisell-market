export type SupplierKind = "unset" | "producer" | "stocker"

type SupplierKindCarrier = {
  supplierKind?: string | null
}

const LABELS: Record<SupplierKind, string> = {
  unset: "Non défini",
  producer: "Producteur",
  stocker: "Stockeur",
}

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
