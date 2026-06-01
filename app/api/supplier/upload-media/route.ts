import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { handleSupplierMediaUpload } from "@/lib/supplier-media-upload-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return handleSupplierMediaUpload(req, session)
}
