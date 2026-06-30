import type { AttributeValueType, Prisma } from "@prisma/client"

export type VariantAttributeInput = {
  attributeId: string
  valueText?: string | null
  valueNumber?: number | null
  valueBoolean?: boolean | null
  optionId?: string | null
}

/** Upsert typed EAV rows for one sellable variant (idempotent on attributeId). */
export async function syncVariantAttributeValues(
  tx: Prisma.TransactionClient,
  variantId: string,
  values: VariantAttributeInput[]
): Promise<number> {
  let written = 0
  for (const row of values) {
    const attributeId = row.attributeId.trim()
    if (!attributeId) continue

    await tx.variantAttributeValue.upsert({
      where: {
        variantId_attributeId: { variantId, attributeId },
      },
      create: {
        variantId,
        attributeId,
        valueText: row.valueText?.trim() || null,
        valueNumber: row.valueNumber != null ? row.valueNumber : null,
        valueBoolean: row.valueBoolean ?? null,
        optionId: row.optionId?.trim() || null,
      },
      update: {
        valueText: row.valueText?.trim() || null,
        valueNumber: row.valueNumber != null ? row.valueNumber : null,
        valueBoolean: row.valueBoolean ?? null,
        optionId: row.optionId?.trim() || null,
      },
    })
    written += 1
  }
  return written
}

export function inferVariantAttributeType(
  type: AttributeValueType
): "text" | "number" | "boolean" | "option" {
  switch (type) {
    case "NUMBER":
    case "UNIT_VALUE":
      return "number"
    case "BOOLEAN":
      return "boolean"
    case "SELECT_SINGLE":
    case "SELECT_MULTI":
      return "option"
    default:
      return "text"
  }
}
