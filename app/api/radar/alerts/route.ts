import { NextResponse } from "next/server"
import type { Prisma } from ".prisma/client-mi"

import { auth } from "@/lib/auth"
import { encryptString } from "@/lib/crypto"
import type { AlertSubscriptionFilters, Severity } from "@/lib/radar/alerts/types"
import { SEVERITY_RANK } from "@/lib/radar/alerts/types"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { gate } from "@/lib/radar/gate"
import { resolveRadarDatabaseUrl } from "@/lib/radar/env"
import { getRadarDb } from "@/lib/prisma-radar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseSeverity(v: string | null): Severity | null {
  if (!v) return null
  return v in SEVERITY_RANK ? (v as Severity) : null
}

/** GET /api/radar/alerts?read=false&severity=high&limit=20 */
export async function GET(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const features =
    Array.isArray(session.user.features) && session.user.features.length > 0
      ? session.user.features
      : resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!resolveRadarDatabaseUrl()) {
    return NextResponse.json({ alerts: [], unreadCount: 0 })
  }

  const url = new URL(req.url)
  const readParam = url.searchParams.get("read")
  const severity = parseSeverity(url.searchParams.get("severity"))
  const type = url.searchParams.get("type")?.trim() || null
  const limitRaw = Number(url.searchParams.get("limit") ?? "20")
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20

  const where: Prisma.RadarAlertWhereInput = {
    OR: [{ userId: null }, { userId: session.user.id }],
  }
  if (readParam === "false") where.read = false
  if (readParam === "true") where.read = true
  if (severity) where.severity = severity
  if (type) where.type = type

  const db = getRadarDb()
  const [alerts, unreadCount] = await Promise.all([
    db.radarAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.radarAlert.count({
      where: {
        OR: [{ userId: null }, { userId: session.user.id }],
        read: false,
      },
    }),
  ])

  return NextResponse.json({ alerts, unreadCount })
}

/** PATCH { id, read: true } */
export async function PATCH(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string; read?: boolean }
  const id = body.id?.trim()
  if (!id || typeof body.read !== "boolean") {
    return NextResponse.json({ error: "id and read required" }, { status: 400 })
  }

  const db = getRadarDb()
  const existing = await db.radarAlert.findFirst({
    where: {
      id,
      OR: [{ userId: null }, { userId: session.user.id }],
    },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await db.radarAlert.update({
    where: { id },
    data: { read: body.read },
  })

  console.log("[radar/alerts]", { userId: session.user.id, id, result: "marked", read: body.read })
  return NextResponse.json({ alert: updated })
}

/** POST { channel, webhookUrl, filters } — upsert AlertSubscription */
export async function POST(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const features =
    Array.isArray(session.user.features) && session.user.features.length > 0
      ? session.user.features
      : resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    channel?: string
    webhookUrl?: string
    filters?: AlertSubscriptionFilters
    active?: boolean
  }

  const channel = body.channel?.trim() || "slack"
  if (!["slack", "email", "webhook"].includes(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 })
  }

  const filters: AlertSubscriptionFilters = body.filters ?? {}
  const encrypted =
    body.webhookUrl?.trim() && body.webhookUrl.trim().length > 0
      ? encryptString(body.webhookUrl.trim())
      : null

  const db = getRadarDb()
  const sub = await db.alertSubscription.upsert({
    where: {
      userId_channel: { userId: session.user.id, channel },
    },
    create: {
      userId: session.user.id,
      channel,
      webhookUrl: encrypted,
      filters: filters as Prisma.InputJsonValue,
      active: body.active !== false,
    },
    update: {
      ...(encrypted ? { webhookUrl: encrypted } : {}),
      filters: filters as Prisma.InputJsonValue,
      active: body.active !== false,
    },
  })

  console.log("[radar/alerts]", {
    userId: session.user.id,
    channel,
    result: "subscription_upserted",
  })

  return NextResponse.json({
    subscription: {
      id: sub.id,
      channel: sub.channel,
      active: sub.active,
      filters: sub.filters,
      hasWebhook: Boolean(sub.webhookUrl),
      createdAt: sub.createdAt,
    },
  })
}
