import { z } from "zod"

import { auth } from "@/auth"
import { loadAffiliateNotificationInbox } from "@/lib/affiliate-notification-inbox"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const forceSync = new URL(req.url).searchParams.get("sync") === "1"

  try {
    const payload = await loadAffiliateNotificationInbox(session.user.id, {
      forceSync,
    })
    return Response.json(payload)
  } catch (error) {
    console.error("[affiliate-notifications]", {
      userId: session.user.id,
      stage: "get",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ unreadCount: 0, notifications: [] }, { status: 200 })
  }
}

const patchSchema = z
  .object({
    markAllRead: z.literal(true).optional(),
    ids: z.array(z.string().min(1)).optional(),
  })
  .strict()

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  if (parsed.data.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })
    return Response.json({ ok: true })
  }

  const ids = parsed.data.ids
  if (!ids?.length) {
    return Response.json({ error: "Provide markAllRead or ids" }, { status: 400 })
  }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, id: { in: ids } },
    data: { read: true },
  })
  return Response.json({ ok: true })
}
