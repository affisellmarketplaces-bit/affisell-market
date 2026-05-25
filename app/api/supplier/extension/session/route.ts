import { type NextRequest, NextResponse } from "next/server"

import {
  extensionCorsHeaders,
  requireSupplierExtensionAuth,
} from "@/lib/supplier-extension-auth"
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
  const authResult = await requireSupplierExtensionAuth(req)
  if (authResult instanceof NextResponse) {
    return cors(req, authResult)
  }

  const user = await prisma.user.findUnique({
    where: { id: authResult },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) {
    return cors(req, NextResponse.json({ error: "User not found" }, { status: 404 }))
  }

  return cors(
    req,
    NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  )
}
