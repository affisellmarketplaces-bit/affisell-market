import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { handleSupplierImportUrl } from "@/lib/supplier-import-url-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  // ADMIN autorisé : testeur Supply Lab (/admin/supply-lab)
  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json()) as {
    url?: string
    options?: { markup?: number; aiRewrite?: boolean }
  }
  return handleSupplierImportUrl(session.user.id, body)
}
