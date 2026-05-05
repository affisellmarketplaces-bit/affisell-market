import { createClient } from "@supabase/supabase-js"

import { auth } from "@/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "product-images"

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function parseDataUrl(input: string): { mime: string; bytes: Uint8Array } {
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error("Invalid imageData format")
  const mime = match[1]
  const base64 = match[2]
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"))
  return { mime, bytes }
}

function normalizeFilename(input: string): string {
  return input.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 64) || "processed-image"
}

async function readImagePayload(req: Request): Promise<{ mime: string; bytes: Uint8Array; filename: string }> {
  const contentType = req.headers.get("content-type") || ""
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      throw new Error("Missing file in multipart form-data. Expected field name 'file'.")
    }
    const buffer = await file.arrayBuffer()
    return {
      mime: file.type || "image/jpeg",
      bytes: new Uint8Array(buffer),
      filename: normalizeFilename(file.name || "processed-image"),
    }
  }

  const body = (await req.json()) as { imageData?: string; filename?: string }
  const imageData = typeof body.imageData === "string" ? body.imageData : ""
  if (!imageData) throw new Error("Missing imageData")
  const { mime, bytes } = parseDataUrl(imageData)
  return {
    mime,
    bytes,
    filename: normalizeFilename(typeof body.filename === "string" ? body.filename : "processed-image"),
  }
}

export async function POST(req: Request) {
  const session = await auth()
  const bypassDevAuth = process.env.NODE_ENV !== "production" && process.env.PHOTO_STUDIO_DEV_BYPASS === "1"
  const effectiveUserId = session?.user?.id || (bypassDevAuth ? "dev-local" : "")
  const effectiveRole = session?.user?.role || (bypassDevAuth ? "SUPPLIER" : "")

  if (!effectiveUserId) {
    console.error("[upload/processed-image] auth missing session", {
      hasSession: Boolean(session),
      role: session?.user?.role ?? null,
    })
    return Response.json(
      {
        error: "Not authenticated",
        detail:
          "You must be logged in as a supplier (cookies/session required). For local debug, set PHOTO_STUDIO_DEV_BYPASS=1.",
      },
      { status: 401 }
    )
  }
  if (effectiveRole !== "SUPPLIER") {
    console.error("[upload/processed-image] wrong role", { role: effectiveRole })
    return Response.json(
      {
        error: "Forbidden",
        detail: `Only suppliers can upload processed images. Current role: ${effectiveRole || "unknown"}.`,
      },
      { status: 403 }
    )
  }

  try {
    const { mime, bytes, filename } = await readImagePayload(req)

    const supabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    )

    // Ensure bucket exists and stays public for direct CDN reads.
    const bucketResult = await supabase.storage.getBucket(BUCKET)
    if (bucketResult.error) {
      const createResult = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 20 * 1024 * 1024,
      })
      if (createResult.error) {
        console.error("[upload/processed-image] createBucket error", createResult.error)
        return Response.json(
          { error: "Supabase createBucket failed", detail: createResult.error.message },
          { status: 500 }
        )
      }
    } else if (bucketResult.data && !bucketResult.data.public) {
      const updateResult = await supabase.storage.updateBucket(BUCKET, {
        public: true,
        fileSizeLimit: 20 * 1024 * 1024,
      })
      if (updateResult.error) {
        console.error("[upload/processed-image] updateBucket error", updateResult.error)
        return Response.json(
          { error: "Supabase updateBucket failed", detail: updateResult.error.message },
          { status: 500 }
        )
      }
    }

    const ext =
      mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg"
    const date = new Date().toISOString().slice(0, 10)
    const path = `${effectiveUserId}/${date}/${Date.now()}-${filename}.${ext}`

    const uploaded = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: "3600",
    })
    if (uploaded.error) {
      console.error("[upload/processed-image] upload error", uploaded.error)
      return Response.json({ error: "Supabase upload failed", detail: uploaded.error.message }, { status: 500 })
    }

    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    return Response.json({ url: publicUrl, path })
  } catch (e) {
    console.error("[upload/processed-image] unexpected error", e)
    const detail = e instanceof Error ? e.message : "Upload failed"
    const status = detail.startsWith("Missing") || detail.startsWith("Invalid") ? 400 : 500
    return Response.json({ error: "Upload failed", detail }, { status })
  }
}
