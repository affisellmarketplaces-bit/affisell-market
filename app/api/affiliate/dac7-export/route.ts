import { auth } from "@/auth"
import { buildAffiliateDac7Csv } from "@/lib/affiliate-dac7-export"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const csv = await buildAffiliateDac7Csv(session.user.id)
  const year = new Date().getUTCFullYear()

  console.log("[affiliate-dac7-export]", {
    userId: session.user.id,
    year,
    bytes: csv.length,
  })

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="affisell-dac7-recap-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
