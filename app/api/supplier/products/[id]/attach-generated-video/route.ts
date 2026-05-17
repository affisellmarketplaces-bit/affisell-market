import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  attachGeneratedVideoToProduct,
  getAttachVideoStatus,
  type AttachVideoPlacement,
} from "@/lib/attach-generated-product-video"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parsePlacement(raw: unknown): AttachVideoPlacement | null {
  if (raw === "description" || raw === "afterGallery") return raw
  return null
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: productId } = await context.params
  const status = await getAttachVideoStatus(productId, session.user.id)
  if (!status) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...status,
    editUrl: `/dashboard/supplier/products/new?edit=${productId}`,
    activePlacement: status.activePlacement,
  })
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: productId } = await context.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const placement = parsePlacement(
    body && typeof body === "object" && "placement" in body
      ? (body as { placement?: unknown }).placement
      : null
  )
  if (!placement) {
    return NextResponse.json(
      { error: "placement must be description or afterGallery" },
      { status: 400 }
    )
  }

  const videoUrl =
    body && typeof body === "object" && "videoUrl" in body
      ? String((body as { videoUrl?: unknown }).videoUrl ?? "").trim()
      : undefined

  const result = await attachGeneratedVideoToProduct({
    productId,
    supplierId: session.user.id,
    placement,
    videoUrl: videoUrl || undefined,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ...result,
    editUrl: `/dashboard/supplier/products/new?edit=${productId}`,
    message:
      placement === "afterGallery"
        ? "Vidéo publiée après les photos produit."
        : "Vidéo publiée dans la description.",
  })
}
