import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { exportUserDataForGdpr } from "@/lib/gdpr/export-user-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      const s = v == null ? "" : String(v)
      return `"${s.replace(/"/g, '""')}"`
    })
    .join(",")
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const format = url.searchParams.get("format") ?? "json"
  const data = await exportUserDataForGdpr(session.user.id)
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (format === "csv") {
    const lines = [
      toCsvRow(["section", "id", "detail", "amount_cents", "created_at"]),
      ...data.orders.asBuyer.map((o) =>
        toCsvRow(["buyer_order", o.id, o.product.name, o.totalCents, o.createdAt.toISOString()])
      ),
      ...data.orders.asSupplier.map((o) =>
        toCsvRow(["supplier_order", o.id, o.product.name, o.supplierPayoutCents, o.createdAt.toISOString()])
      ),
      ...data.orders.asAffiliate.map((o) =>
        toCsvRow([
          "affiliate_order",
          o.id,
          o.product.name,
          o.affiliatePayoutCents + o.affiliateMarginRetainedCents,
          o.createdAt.toISOString(),
        ])
      ),
    ]
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="affisell-export-${session.user.id}.csv"`,
      },
    })
  }

  return NextResponse.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="affisell-export-${session.user.id}.json"`,
    },
  })
}
