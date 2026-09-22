import type { SupplierChannelType } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { AUTO_BUY_SOURCING_CHANNELS } from "@/lib/auto-buy-sourcing-channels"

export type AdminAutoBuySupplierRow = {
  userId: string
  email: string
  name: string | null
  storeName: string | null
  storeSlug: string | null
  linkedSkuCount: number
  /** Active grant per sourcing channel. */
  authorized: Partial<Record<SupplierChannelType, boolean>>
}

export type AdminAutoBuyAuthorizationsResponse = {
  rows: AdminAutoBuySupplierRow[]
  channels: readonly SupplierChannelType[]
}

/** Admin panel: every supplier + their auto-buy authorization state per sourcing channel. */
export async function loadAdminAutoBuyAuthorizations(): Promise<AdminAutoBuyAuthorizationsResponse> {
  const [suppliers, grants] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SUPPLIER" },
      select: {
        id: true,
        email: true,
        name: true,
        store: { select: { name: true, slug: true } },
        _count: { select: { products: { where: { supplierLink: { isNot: null } } } } },
      },
      orderBy: [{ store: { name: "asc" } }, { email: "asc" }],
    }),
    prisma.supplierAutoBuyAuthorization.findMany({
      where: { revokedAt: null },
      select: { supplierId: true, channelType: true },
    }),
  ])

  const grantedByBySupplier = new Map<string, Set<SupplierChannelType>>()
  for (const g of grants) {
    const set = grantedByBySupplier.get(g.supplierId) ?? new Set<SupplierChannelType>()
    set.add(g.channelType)
    grantedByBySupplier.set(g.supplierId, set)
  }

  const rows: AdminAutoBuySupplierRow[] = suppliers.map((s) => {
    const granted = grantedByBySupplier.get(s.id) ?? new Set<SupplierChannelType>()
    const authorized: Partial<Record<SupplierChannelType, boolean>> = {}
    for (const channel of AUTO_BUY_SOURCING_CHANNELS) {
      authorized[channel] = granted.has(channel)
    }
    return {
      userId: s.id,
      email: s.email,
      name: s.name,
      storeName: s.store?.name ?? null,
      storeSlug: s.store?.slug ?? null,
      linkedSkuCount: s._count.products,
      authorized,
    }
  })

  return { rows, channels: AUTO_BUY_SOURCING_CHANNELS }
}
