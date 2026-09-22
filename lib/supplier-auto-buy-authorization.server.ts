import "server-only"

import type { SupplierChannelType } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { AUTO_BUY_SOURCING_CHANNELS, isAutoBuySourcingChannel } from "@/lib/auto-buy-sourcing-channels"

export type SupplierAutoBuyAuthorizationDto = {
  id: string
  supplierId: string
  channelType: SupplierChannelType
  active: boolean
  grantedAt: string
  grantedByName: string | null
  revokedAt: string | null
  note: string | null
}

function serialize(row: {
  id: string
  supplierId: string
  channelType: SupplierChannelType
  grantedAt: Date
  revokedAt: Date | null
  note: string | null
  grantedBy: { name: string | null; email: string | null } | null
}): SupplierAutoBuyAuthorizationDto {
  return {
    id: row.id,
    supplierId: row.supplierId,
    channelType: row.channelType,
    active: !row.revokedAt,
    grantedAt: row.grantedAt.toISOString(),
    grantedByName: row.grantedBy?.name ?? row.grantedBy?.email ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    note: row.note,
  }
}

/** Non-sourcing channels (native/blind-rest/manual) never need this gate. */
export function channelRequiresAuthorization(channel: SupplierChannelType): boolean {
  return isAutoBuySourcingChannel(channel)
}

/** The single source of truth `resolveFulfillmentChannel` checks before spending real money. */
export async function isSupplierAuthorizedForChannel(
  supplierId: string,
  channel: SupplierChannelType
): Promise<boolean> {
  if (!channelRequiresAuthorization(channel)) return true
  const row = await prisma.supplierAutoBuyAuthorization.findUnique({
    where: { supplierId_channelType: { supplierId, channelType: channel } },
    select: { revokedAt: true },
  })
  return Boolean(row) && !row!.revokedAt
}

/** All active sourcing channels a supplier is currently authorized for. */
export async function listAuthorizedChannelsForSupplier(
  supplierId: string
): Promise<SupplierChannelType[]> {
  const rows = await prisma.supplierAutoBuyAuthorization.findMany({
    where: { supplierId, revokedAt: null },
    select: { channelType: true },
  })
  return rows.map((r) => r.channelType)
}

/** Admin panel: every sourcing channel's grant state for one supplier (grant rows may not exist yet). */
export async function loadSupplierAutoBuyAuthorizations(
  supplierId: string
): Promise<SupplierAutoBuyAuthorizationDto[]> {
  const rows = await prisma.supplierAutoBuyAuthorization.findMany({
    where: { supplierId },
    include: { grantedBy: { select: { name: true, email: true } } },
  })
  const byChannel = new Map(rows.map((r) => [r.channelType, r]))
  return AUTO_BUY_SOURCING_CHANNELS.map((channel) => {
    const row = byChannel.get(channel)
    if (row) return serialize(row)
    return {
      id: "",
      supplierId,
      channelType: channel,
      active: false,
      grantedAt: "",
      grantedByName: null,
      revokedAt: null,
      note: null,
    }
  })
}

export async function setSupplierAutoBuyAuthorization(input: {
  supplierId: string
  channelType: SupplierChannelType
  enabled: boolean
  adminUserId: string
  note?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAutoBuySourcingChannel(input.channelType)) {
    return { ok: false, error: "not_a_sourcing_channel" }
  }
  const supplier = await prisma.user.findUnique({
    where: { id: input.supplierId },
    select: { id: true, role: true },
  })
  if (!supplier || supplier.role !== "SUPPLIER") {
    return { ok: false, error: "supplier_not_found" }
  }

  if (input.enabled) {
    await prisma.supplierAutoBuyAuthorization.upsert({
      where: { supplierId_channelType: { supplierId: input.supplierId, channelType: input.channelType } },
      create: {
        supplierId: input.supplierId,
        channelType: input.channelType,
        grantedById: input.adminUserId,
        note: input.note?.trim() || null,
      },
      update: {
        revokedAt: null,
        grantedById: input.adminUserId,
        grantedAt: new Date(),
        note: input.note?.trim() || null,
      },
    })
  } else {
    await prisma.supplierAutoBuyAuthorization.updateMany({
      where: { supplierId: input.supplierId, channelType: input.channelType },
      data: { revokedAt: new Date() },
    })
  }

  console.log("[auto-buy-authorization]", {
    supplierId: input.supplierId,
    channelType: input.channelType,
    enabled: input.enabled,
    adminUserId: input.adminUserId,
  })
  return { ok: true }
}
