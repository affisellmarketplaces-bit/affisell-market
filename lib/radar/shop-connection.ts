import "server-only"

import { getMiDb } from "@/lib/prisma-mi"

export type RadarShopConnectionSummary = {
  shopId: string
  shopName: string
  expiresAt: Date
  scopes: string[]
  updatedAt: Date
}

export async function getRadarShopConnection(
  userId: string
): Promise<RadarShopConnectionSummary | null> {
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
