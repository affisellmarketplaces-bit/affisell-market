import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { handleSupplierMediaUpload } from "@/lib/supplier-media-upload-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Veo / références visuelles — même stockage que POST /api/supplier/upload-media. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Supplier session required" }, { status: 401 })
  }

  const form = await req.formData()
  const wrapped = new FormData()
  for (const [key, value] of form.entries()) {
    wrapped.append(key, value)
  }
  if (!wrapped.has("subfolder")) {
    wrapped.set("subfolder", "video-refs")
  }

  return handleSupplierMediaUpload(
    new Request(req.url, { method: "POST", body: wrapped }),
    session
  )
}
