import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { parsePushSubscribeJson } from "@/lib/push-subscribe-shared"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parsePushSubscribeJson((body as { subscription?: unknown }).subscription)
  if (!parsed) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.endpoint },
    create: {
      userId: session.user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
    },
    update: {
      userId: session.user.id,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
    },
  })

  console.log("[push-subscribe]", { userId: session.user.id, result: "saved" })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let endpoint: string | null = null
  try {
    const body = (await req.json()) as { endpoint?: unknown }
    endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : null
  } catch {
    /* empty body */
  }

  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id, endpoint },
    })
  } else {
    await prisma.pushSubscription.deleteMany({ where: { userId: session.user.id } })
  }

  console.log("[push-subscribe]", { userId: session.user.id, result: "removed" })
  return NextResponse.json({ ok: true })
}
