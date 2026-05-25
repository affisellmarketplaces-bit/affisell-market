import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isSupplierOrAdminRole } from "@/lib/supplier-or-admin-session"
import { resolveSupplierIdFromExtensionToken } from "@/lib/supplier-extension-token"
import { prisma } from "@/lib/prisma"

const EXTENSION_AUTH_HEADER = "authorization"

export function extensionBearerFromRequest(req: Request): string | null {
  const raw = req.headers.get(EXTENSION_AUTH_HEADER)
  if (!raw) return null
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() ?? null
}

/** Supplier id from extension Bearer token, or null. */
export async function supplierIdFromExtensionRequest(
  req: Request
): Promise<string | null> {
  const bearer = extensionBearerFromRequest(req)
  if (!bearer) return null
  const userId = await resolveSupplierIdFromExtensionToken(bearer)
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user || !isSupplierOrAdminRole(user.role)) return null
  return userId
}

export async function requireSupplierExtensionAuth(
  req: Request
): Promise<string | NextResponse> {
  const supplierId = await supplierIdFromExtensionRequest(req)
  if (supplierId) return supplierId

  return NextResponse.json(
    { error: "Unauthorized. Connect the extension from your Affisell supplier dashboard." },
    { status: 401 }
  )
}

export function extensionCorsHeaders(origin: string | null): HeadersInit {
  if (!origin) return {}
  const allowed =
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (!allowed) return {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

export async function requireSupplierSessionOrExtension(
  req: Request
): Promise<{ supplierId: string } | NextResponse> {
  const fromExt = await supplierIdFromExtensionRequest(req)
  if (fromExt) return { supplierId: fromExt }

  const session = await auth()
  if (!session?.user?.id || !isSupplierOrAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return { supplierId: session.user.id }
}
