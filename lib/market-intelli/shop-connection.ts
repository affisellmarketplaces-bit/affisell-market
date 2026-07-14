import "server-only"

import { getMiDb } from "@/lib/prisma-mi"

export type MiShopConnectionSummary = {
  shopId: string
  shopName: string
  expiresAt: Date
  scopes: string[]
  updatedAt: Date
}

export async function getMiShopConnection(userId: string): Promise<MiShopConnectionSummary | null> {
  const row = await getMiDb().shopConnection.findUnique({
    where: { userId },
    select: {
      shopId: true,
      shopName: true,
      expiresAt: true,
      scopes: true,
      updatedAt: true,
    },
  })
  return row
}
