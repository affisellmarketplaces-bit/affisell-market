import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  loadSupplierShopShippingOffers,
  saveSupplierShopShippingOffers,
} from "@/lib/shipping/supplier-shipping-profile.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireSupplier() {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  }
  return { userId: session.user.id }
}

/** The signed-in supplier's shop shipping profile (carriers + delivery windows they committed to). */
export async function GET() {
  const who = await requireSupplier()
  if ("error" in who) return who.error
  return NextResponse.json({ offers: await loadSupplierShopShippingOffers(who.userId) })
}

/** Replaces the profile. Input is validated server-side (known carriers, sane windows, no duplicates). */
export async function PUT(req: Request) {
  const who = await requireSupplier()
  if ("error" in who) return who.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const raw = (body as { offers?: unknown } | null)?.offers
  if (!Array.isArray(raw)) return NextResponse.json({ error: "offers_required" }, { status: 400 })

  try {
    const offers = await saveSupplierShopShippingOffers(who.userId, raw)
    return NextResponse.json({ offers })
  } catch (error) {
    console.error("[api/supplier/shipping-profile] save failed", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "save_failed" }, { status: 500 })
  }
}
