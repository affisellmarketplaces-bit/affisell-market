import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { videoLog } from "@/lib/video-logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "product-images"
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_VIDEO_BYTES = 48 * 1024 * 1024

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function normalizeFilename(input: string): string {
  return input.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 64) || "reference"
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "Supplier session required" }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  const isImage = file.type.startsWith("image/")
  const isVideo = file.type.startsWith("video/")
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "File must be an image or video" }, { status: 400 })
  }

  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: isImage ? "Image must be under 12 MB" : "Video must be under 48 MB" },
      { status: 400 }
    )
  }

  try {
    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    )

    const bytes = new Uint8Array(await file.arrayBuffer())
    const filename = normalizeFilename(file.name || "reference")
    const ext = isVideo
      ? file.type.includes("webm")
        ? "webm"
        : file.type.includes("quicktime")
          ? "mov"
          : "mp4"
      : file.type.includes("png")
        ? "png"
        : file.type.includes("webp")
          ? "webp"
          : "jpg"

    const date = new Date().toISOString().slice(0, 10)
    const path = `${session.user.id}/video-refs/${date}/${Date.now()}-${filename}.${ext}`

    const uploaded = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
      upsert: false,
      cacheControl: "3600",
    })

    if (uploaded.error) {
      videoLog.warn("generate-video.reference.upload", {
        userId: session.user.id,
        error: uploaded.error.message,
      })
      return NextResponse.json({ error: "Upload failed", detail: uploaded.error.message }, { status: 500 })
    }

    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    videoLog.info("generate-video.reference.upload", {
      userId: session.user.id,
      kind: isVideo ? "video" : "image",
      path,
    })

    return NextResponse.json({
      url,
      kind: isVideo ? "video" : "image",
    })
  } catch (e) {
    videoLog.error("generate-video.reference.failed", {
      userId: session.user.id,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    )
  }
}
