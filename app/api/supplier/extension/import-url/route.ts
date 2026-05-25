import { type NextRequest, NextResponse } from "next/server"

import {
  extensionCorsHeaders,
  requireSupplierExtensionAuth,
} from "@/lib/supplier-extension-auth"
import {
  handleSupplierImportUrl,
  type SupplierImportUrlBody,
} from "@/lib/supplier-import-url-handler"

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

export async function POST(req: NextRequest) {
  const authResult = await requireSupplierExtensionAuth(req)
  if (authResult instanceof NextResponse) {
    return cors(req, authResult)
  }

  const body = (await req.json()) as SupplierImportUrlBody
  const res = await handleSupplierImportUrl(authResult, body)
  return cors(req, res)
}
