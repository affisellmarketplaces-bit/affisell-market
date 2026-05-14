import { auth } from "@/auth"
import { buildBuyerOrdersPayloadForEmail } from "@/lib/account-orders-payload"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const payload = await buildBuyerOrdersPayloadForEmail(session.user.email)
  return Response.json(payload)
}
