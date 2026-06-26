import { auth } from "@/auth"
import { SupplierGalleryMinDimensionError } from "@/lib/supplier-gallery-process.server"
import { uploadSupplierGalleryImage } from "@/lib/supplier-gallery-upload.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function parseDataUrl(input: string): Buffer {
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error("Invalid imageData format")
  return Buffer.from(match[2], "base64")
}

function normalizeFilename(input: string): string {
  return input.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 64) || "processed-image"
}

async function readImageBytes(req: Request): Promise<{ bytes: Buffer; filename: string }> {
  const contentType = req.headers.get("content-type") || ""
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      throw new Error("Missing file in multipart form-data. Expected field name 'file'.")
    }
    const buffer = await file.arrayBuffer()
    return {
      bytes: Buffer.from(buffer),
      filename: normalizeFilename(file.name || "processed-image"),
    }
  }

  const body = (await req.json()) as { imageData?: string; filename?: string }
  const imageData = typeof body.imageData === "string" ? body.imageData : ""
  if (!imageData) throw new Error("Missing imageData")
  return {
    bytes: parseDataUrl(imageData),
    filename: normalizeFilename(typeof body.filename === "string" ? body.filename : "processed-image"),
  }
}

export async function POST(req: Request) {
  const session = await auth()
  const bypassDevAuth =
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL !== "1" &&
    process.env.PHOTO_STUDIO_DEV_BYPASS === "1"
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
    const { bytes, filename } = await readImageBytes(req)
    const { url, storage } = await uploadSupplierGalleryImage({
      userId: effectiveUserId,
      bytes,
      filename,
    })
    return Response.json({ url, storage })
  } catch (e) {
    if (e instanceof SupplierGalleryMinDimensionError) {
      console.log("[upload/processed-image] min dimension", {
        width: e.width,
        height: e.height,
      })
      return Response.json(
        {
          error: "Image too small",
          detail: `Minimum ${320}×${320} px (got ${e.width}×${e.height})`,
        },
        { status: 400 }
      )
    }
    console.error("[upload/processed-image] unexpected error", e)
    const detail = e instanceof Error ? e.message : "Upload failed"
    const status = detail.startsWith("Missing") || detail.startsWith("Invalid") ? 400 : 500
    return Response.json({ error: "Upload failed", detail }, { status })
  }
}
