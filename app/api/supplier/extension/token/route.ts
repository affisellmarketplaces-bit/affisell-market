import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { isSupplierOrAdminRole } from "@/lib/supplier-or-admin-session"
import {
  createSupplierExtensionToken,
  revokeSupplierExtensionToken,
} from "@/lib/supplier-extension-token"
import { extensionCorsHeaders } from "@/lib/supplier-extension-auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function cors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get("origin")
  const headers = extensionCorsHeaders(origin)
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v as string)
  }
  return res
}

export async function OPTIONS(req: NextRequest) {
  return cors(req, new NextResponse(null, { status: 204 }))
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isSupplierOrAdminRole(session.user.role)) {
    return cors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }))
  }

  const tokens = await prisma.supplierExtensionToken.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
    },
  })

  return cors(req, NextResponse.json({ tokens }))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isSupplierOrAdminRole(session.user.role)) {
    return cors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }))
  }

  const body = (await req.json().catch(() => ({}))) as { label?: string }
  const created = await createSupplierExtensionToken({
    userId: session.user.id,
    label: typeof body.label === "string" ? body.label : "Chrome",
  })

  return cors(
    req,
    NextResponse.json({
      token: created.token,
      id: created.id,
      label: created.label,
      createdAt: created.createdAt,
      hint: "Copy this token now — it will not be shown again.",
    })
  )
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isSupplierOrAdminRole(session.user.role)) {
    return cors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }))
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string }
  const tokenId = typeof body.id === "string" ? body.id.trim() : ""
  if (!tokenId) {
    return cors(req, NextResponse.json({ error: "id required" }, { status: 400 }))
  }

  const ok = await revokeSupplierExtensionToken({
    userId: session.user.id,
    tokenId,
  })
  if (!ok) {
    return cors(req, NextResponse.json({ error: "Token not found" }, { status: 404 }))
  }

  return cors(req, NextResponse.json({ success: true }))
}
