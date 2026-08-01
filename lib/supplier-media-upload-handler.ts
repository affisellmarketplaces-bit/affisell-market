import { NextResponse } from "next/server"

import {
  contentTypeForSupplierFile,
  extensionForSupplierFile,
  normalizeSupplierMediaFilename,
  SUPPLIER_MEDIA_STORAGE_UNAVAILABLE,
  uploadSupplierMediaBuffer,
  type SupplierMediaKind,
} from "@/lib/supplier-media-storage.server"
import {
  isImageSniff,
  isVideoSniff,
  sniffUploadBytes,
} from "@/lib/upload-content-sniff"
import { videoLog } from "@/lib/video-logger"

const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_VIDEO_BYTES = 48 * 1024 * 1024

type SupplierUploadSession = {
  user?: { id?: string; role?: string } | null
}

export async function handleSupplierMediaUpload(
  req: Request,
  session: SupplierUploadSession
): Promise<NextResponse> {
  const userId = session.user?.id
  if (!userId || session.user?.role !== "SUPPLIER") {
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

  const claimedImage = file.type.startsWith("image/")
  const claimedVideo =
    file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
  if (!claimedImage && !claimedVideo) {
    return NextResponse.json({ error: "File must be an image or video" }, { status: 400 })
  }

  const kind: SupplierMediaKind = claimedVideo ? "video" : "image"
  const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: kind === "image" ? "Image must be under 12 MB" : "Video must be under 48 MB" },
      { status: 400 }
    )
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const sniffed = sniffUploadBytes(bytes)
  if (!sniffed) {
    console.log("[supplier-media]", { result: "sniff_rejected", userId })
    return NextResponse.json({ error: "Unrecognized or unsafe file content" }, { status: 400 })
  }
  if (kind === "image" && !isImageSniff(sniffed.kind)) {
    return NextResponse.json({ error: "File content is not a supported image" }, { status: 400 })
  }
  if (kind === "video" && !isVideoSniff(sniffed.kind)) {
    return NextResponse.json({ error: "File content is not a supported video" }, { status: 400 })
  }

  const ext =
    sniffed.kind === "jpeg"
      ? "jpg"
      : sniffed.kind === "png"
        ? "png"
        : sniffed.kind === "webp"
          ? "webp"
          : sniffed.kind === "gif"
            ? "gif"
            : sniffed.kind === "webm"
              ? "webm"
              : sniffed.kind === "mp4"
                ? "mp4"
                : extensionForSupplierFile(file, kind)
  const contentType = sniffed.mime || contentTypeForSupplierFile(file, kind, ext)
  const filenameBase = normalizeSupplierMediaFilename(file.name || kind)
  const subfolder = form.get("subfolder") === "video-refs" ? "video-refs" : undefined

  try {
    const { url, storage } = await uploadSupplierMediaBuffer({
      userId,
      bytes,
      contentType,
      ext,
      kind,
      filenameBase,
      subfolder,
    })

    videoLog.info("supplier-media.upload", {
      userId,
      kind,
      storage,
      sniffed: sniffed.kind,
    })

    return NextResponse.json({
      url,
      kind,
      storage,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed"
    videoLog.error("supplier-media.upload.failed", {
      userId,
      kind,
      error: message,
    })
    const status = message === SUPPLIER_MEDIA_STORAGE_UNAVAILABLE ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
