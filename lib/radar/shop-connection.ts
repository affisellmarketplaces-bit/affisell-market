import "server-only"

import { getRadarDb } from "@/lib/prisma-radar"

export type RadarShopConnectionSummary = {
  shopId: string
  shopName: string
  connectorId: string
  region: string
  expiresAt: Date | null
  scopes: string[]
  status: string
  updatedAt: Date
}

export async function getRadarShopConnection(
  userId: string
): Promise<RadarShopConnectionSummary | null> {
  const row = await getRadarDb().shopConnection.findFirst({
    where: { userId },
    select: {
      shopId: true,
      shopName: true,
      connectorId: true,
      region: true,
      expiresAt: true,
      scopes: true,
      status: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  })
  return row
}
