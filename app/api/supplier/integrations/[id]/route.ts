import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  maskIntegrationConfig,
  normalizeIntegrationName,
  newWebhookSecret,
  parseShopifyIntegrationConfig,
} from "@/lib/supplier-integration-config"
import { prisma } from "@/lib/prisma"
import { normalizeShopifyAdminHost } from "@/lib/shopify-sync-map"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const existing = await prisma.supplierIntegration.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const data: {
    name?: string
    enabled?: boolean
    config?: object
  } = {}

  if (typeof body.enabled === "boolean") data.enabled = body.enabled

  if (body.name !== undefined) {
    data.name = normalizeIntegrationName(body.name)
  }

  const prevConfig =
    existing.config && typeof existing.config === "object" && !Array.isArray(existing.config)
      ? (existing.config as Record<string, unknown>)
      : {}

  if (body.config !== undefined || body.regenerateWebhookSecret === true) {
    if (body.config !== undefined) {
      if (!body.config || typeof body.config !== "object" || Array.isArray(body.config)) {
        return NextResponse.json({ error: "config must be an object" }, { status: 400 })
      }
    }

    const next =
      body.config !== undefined
        ? { ...prevConfig, ...(body.config as Record<string, unknown>) }
        : { ...prevConfig }

    if (existing.platform === "shopify") {
      if (typeof next.shop === "string") {
        const h = normalizeShopifyAdminHost(next.shop)
        if (!h) {
          return NextResponse.json(
            { error: "config.shop must be a myshopify.com host" },
            { status: 400 }
          )
        }
        next.shop = h
      }
      if (!parseShopifyIntegrationConfig(next)) {
        return NextResponse.json(
          { error: "After merge, Shopify shop and access token are invalid" },
          { status: 400 }
        )
      }
    }

    if (existing.platform === "webhook" && body.regenerateWebhookSecret === true) {
      next.webhookSecret = newWebhookSecret()
    }

    if (body.config !== undefined || body.regenerateWebhookSecret === true) {
      data.config = next as object
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 })
  }

  try {
    const row = await prisma.supplierIntegration.update({
      where: { id },
      data,
      select: {
        id: true,
        platform: true,
        name: true,
        enabled: true,
        config: true,
        lastSyncAt: true,
        lastSyncError: true,
        lastSyncSummary: true,
      },
    })

    const out: Record<string, unknown> = {
      integration: { ...row, config: maskIntegrationConfig(row.config) },
    }

    if (
      existing.platform === "webhook" &&
      body.regenerateWebhookSecret === true &&
      data.config &&
      typeof data.config === "object" &&
      !Array.isArray(data.config)
    ) {
      const ws = (data.config as Record<string, unknown>).webhookSecret
      if (typeof ws === "string") out.webhookSecretPlain = ws
    }

    return NextResponse.json(out)
  } catch {
    return NextResponse.json(
      { error: "Name conflict or update failed" },
      { status: 409 }
    )
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await ctx.params

  const del = await prisma.supplierIntegration.deleteMany({
    where: { id, userId: session.user.id },
  })

  if (del.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
