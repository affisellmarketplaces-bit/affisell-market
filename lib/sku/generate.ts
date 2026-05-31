import { prisma } from "@/lib/prisma"

const AFF_SKU_RE = /^AFF-(\d+)$/

/** Next sequential Affisell product SKU (AFF-00001). Idempotent per call until saved. */
export async function generateAffisellSku(): Promise<string> {
  const rows = await prisma.product.findMany({
    where: { affisellSku: { not: null } },
    select: { affisellSku: true },
  })

  let max = 0
  for (const row of rows) {
    const sku = row.affisellSku
    if (!sku) continue
    const m = sku.match(AFF_SKU_RE)
    if (m) max = Math.max(max, Number.parseInt(m[1], 10))
  }

  const num = (max + 1).toString().padStart(5, "0")
  return `AFF-${num}`
}

/** Variant SKU suffix from attribute values (AFF-00001-BLK-M). */
export function generateVariantSku(
  baseSku: string,
  attributes: Record<string, string>
): string {
  const parts = Object.values(attributes)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.substring(0, 3).toUpperCase())
  if (parts.length === 0) return baseSku
  return `${baseSku}-${parts.join("-")}`
}
