import { isBlindDropshipCheckoutPayload, blindDropshipCheckoutPOST } from "@/lib/blind-dropship-checkout"
import { marketplaceCheckoutPOST } from "@/lib/marketplace-checkout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const raw = await request.text()
  let parsed: unknown = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (isBlindDropshipCheckoutPayload(parsed)) {
    return blindDropshipCheckoutPOST(parsed)
  }
  return marketplaceCheckoutPOST(
    new Request(request.url, { method: "POST", body: raw, headers: request.headers })
  )
}
