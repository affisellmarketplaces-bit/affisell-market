import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import {
  buildLogisticsAddressFromPartial,
  effectiveReturnAddress,
  formatSupplierLogisticsAddress,
  logisticsAddressFromFormBody,
  parseSupplierLogisticsAddress,
  type SupplierLogisticsAddress,
} from "@/lib/supplier-logistics-address"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type LogisticsJson = {
  shipFrom: SupplierLogisticsAddress | null
  returnAddress: SupplierLogisticsAddress | null
  returnSameAsShip: boolean
  shipFromFormatted: string | null
  returnFormatted: string | null
}

function toResponse(
  shipFrom: SupplierLogisticsAddress | null,
  ret: SupplierLogisticsAddress | null
): LogisticsJson {
  const effective = effectiveReturnAddress(shipFrom, ret)
  return {
    shipFrom,
    returnAddress: ret,
    returnSameAsShip: ret === null,
    shipFromFormatted: shipFrom ? formatSupplierLogisticsAddress(shipFrom) : null,
    returnFormatted: effective ? formatSupplierLogisticsAddress(effective) : null,
  }
}

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!u) return Response.json({ error: "Not found" }, { status: 404 })
    store = await ensureMerchantStore({ userId, email: u.email, displayName: u.name })
  }

  const shipFrom = parseSupplierLogisticsAddress(store.shipFromAddress)
  const ret = parseSupplierLogisticsAddress(store.returnAddress)
  return Response.json(toResponse(shipFrom, ret))
}

export async function PUT(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!u) return Response.json({ error: "Not found" }, { status: 404 })
    store = await ensureMerchantStore({ userId, email: u.email, displayName: u.name })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }
  const o = body as Record<string, unknown>

  const shipPartial = logisticsAddressFromFormBody(o.shipFrom)
  const shipFrom = buildLogisticsAddressFromPartial(shipPartial)
  if (!shipFrom && Object.values(shipPartial).some((v) => typeof v === "string" && v.length > 0)) {
    return Response.json(
      { error: "Ship-from address: fill line 1, city, postal code, and a 2-letter country code." },
      { status: 400 }
    )
  }

  const returnSame =
    o.returnSameAsShip === true || o.returnSameAsShip === "true" || o.returnSameAsShip === 1

  let returnJson: SupplierLogisticsAddress | null = null
  if (!returnSame) {
    const retPartial = logisticsAddressFromFormBody(o.returnAddress)
    const ret = buildLogisticsAddressFromPartial(retPartial)
    if (!ret && Object.values(retPartial).some((v) => typeof v === "string" && v.length > 0)) {
      return Response.json(
        { error: "Return address: fill line 1, city, postal code, and a 2-letter country code (or enable “same as ship-from”)." },
        { status: 400 }
      )
    }
    returnJson = ret
  }

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: {
      shipFromAddress: shipFrom ? (shipFrom as Prisma.InputJsonValue) : Prisma.JsonNull,
      returnAddress: returnSame
        ? Prisma.JsonNull
        : returnJson
          ? (returnJson as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  })

  const sf = parseSupplierLogisticsAddress(updated.shipFromAddress)
  const rt = parseSupplierLogisticsAddress(updated.returnAddress)
  return Response.json({ ok: true, ...toResponse(sf, rt) })
}
