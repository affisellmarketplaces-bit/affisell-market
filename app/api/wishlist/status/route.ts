import { auth } from "@/auth"
import { readGuestWishlistId } from "@/lib/guest-wishlist-id"
import {
  normalizeWishlistStatusIds,
  resolveWishlistCardStatuses,
} from "@/lib/wishlist-card-status.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
  ids?: unknown
}

/** POST batch — avoids long GET query strings on marketplace grids. */
export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const guestId = userId ? null : await readGuestWishlistId()

  const body = (await req.json().catch(() => ({}))) as Body
  const raw = Array.isArray(body.ids) ? body.ids : []
  const ids = normalizeWishlistStatusIds(
    raw.filter((id): id is string => typeof id === "string")
  )
  if (ids.length === 0) {
    return Response.json({ statuses: {} }, { headers: { "Cache-Control": "private, no-store" } })
  }

  const statuses = await resolveWishlistCardStatuses(ids, { userId, guestId })
  return Response.json({ statuses }, { headers: { "Cache-Control": "private, no-store" } })
}
