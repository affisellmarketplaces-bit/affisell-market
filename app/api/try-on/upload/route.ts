import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

import { resolveTryOnFeatureEnabled } from "@/lib/flags/try-on"
import { processTryOnUserImage, uploadTryOnBlob } from "@/lib/try-on/image-processing.server"
import { scanTryOnUpload } from "@/lib/try-on/virus-scan.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 10

export async function POST(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTag("feature", "tryon")
    scope.setTag("model", "idm-vton")

    const url = new URL(req.url)
    if (!resolveTryOnFeatureEnabled(url.searchParams)) {
      return NextResponse.json({ error: "Try-on feature is disabled" }, { status: 404 })
    }

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
    }

    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const scan = await scanTryOnUpload(bytes, file.type || "application/octet-stream")
    if (!scan.safe) {
      console.log("[try-on]", { result: "upload_rejected", reason: scan.reason })
      return NextResponse.json({ error: scan.reason }, { status: 422 })
    }

    const processed = await processTryOnUserImage(bytes, file.type || "image/jpeg")
    const uploadedUrl = await uploadTryOnBlob({
      bytes: processed.bytes,
      contentType: processed.contentType,
      folder: "inputs",
      keySuffix: "user",
    })

    console.log("[try-on]", {
      result: "upload_ok",
      width: processed.width,
      height: processed.height,
    })

    return NextResponse.json({
      inputUrl: uploadedUrl,
      width: processed.width,
      height: processed.height,
    })
  })
}
