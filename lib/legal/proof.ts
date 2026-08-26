import { createHash } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type LegalProofAction = "scan" | "fix" | "removal" | "recall" | "dsa_report"

export type CreateProofInput = {
  productId?: string | null
  action: LegalProofAction
  payload: Record<string, unknown>
}

export function hashProofPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

export async function createProof(input: CreateProofInput): Promise<{ id: string; hash: string }> {
  const hash = hashProofPayload(input.payload)

  const row = await prisma.legalProof.create({
    data: {
      productId: input.productId ?? null,
      action: input.action,
      hash,
      payload: input.payload as Prisma.InputJsonValue,
    },
  })

  console.log("[legal:proof]", {
    result: "created",
    id: row.id,
    action: input.action,
    productId: input.productId ?? null,
    hash: hash.slice(0, 16),
  })

  return { id: row.id, hash }
}

export async function listProofsForProduct(productId: string, limit = 20) {
  return prisma.legalProof.findMany({
    where: { productId },
    orderBy: { timestamp: "desc" },
    take: limit,
  })
}
