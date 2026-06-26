import "server-only"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { put } from "@vercel/blob"
import { createClient } from "@supabase/supabase-js"

import { isR2Configured, uploadBufferToR2 } from "@/lib/r2"
import { videoLog } from "@/lib/video-logger"

export type SupplierMediaKind = "image" | "video"

export const SUPPLIER_MEDIA_STORAGE_UNAVAILABLE =
  "Stockage média indisponible. L’équipe doit configurer R2 ou Vercel Blob sur le serveur."

const SUPABASE_IMAGES_BUCKET = "product-images"

function getSupabaseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    null
  )
}

function getSupabaseServiceKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
}

function getS3Client(): S3Client | null {
  const region = process.env.AWS_REGION?.trim()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()
  if (!region || !accessKeyId || !secretAccessKey) return null
  return new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })
}

export function normalizeSupplierMediaFilename(input: string): string {
  return (
    input
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "media"
  )
}

export function extensionForSupplierFile(
  file: Pick<File, "type" | "name">,
  kind: SupplierMediaKind
): string {
  if (kind === "video") {
    if (file.type.includes("webm")) return "webm"
    if (file.type.includes("quicktime")) return "mov"
    return "mp4"
  }
  if (file.type.includes("png")) return "png"
  if (file.type.includes("webp")) return "webp"
  return "jpg"
}

export function contentTypeForSupplierFile(
  file: Pick<File, "type">,
  kind: SupplierMediaKind,
  ext: string
): string {
  if (file.type?.trim()) return file.type
  if (kind === "video") {
    if (ext === "webm") return "video/webm"
    if (ext === "mov") return "video/quicktime"
    return "video/mp4"
  }
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  return "image/jpeg"
}

function publicS3Url(bucket: string, region: string, key: string): string {
  const enc = encodeURIComponent(key).replace(/%2F/g, "/")
  return `https://${bucket}.s3.${region}.amazonaws.com/${enc}`
}

async function uploadToS3(bytes: Buffer, key: string, contentType: string): Promise<string | null> {
  const bucket = process.env.AWS_BUCKET_NAME?.trim()
  const region = process.env.AWS_REGION?.trim()
  const client = getS3Client()
  if (!client || !bucket || !region) return null

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return publicS3Url(bucket, region, key)
}

async function uploadToSupabase(
  bytes: Buffer,
  path: string,
  contentType: string
): Promise<string | null> {
  const url = getSupabaseUrl()
  const key = getSupabaseServiceKey()
  if (!url || !key) return null

  const supabase = createClient(url, key)

  const bucketResult = await supabase.storage.getBucket(SUPABASE_IMAGES_BUCKET)
  if (bucketResult.error) {
    const created = await supabase.storage.createBucket(SUPABASE_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    })
    if (created.error) {
      videoLog.warn("supplier-media.supabase", {
        error: created.error.message,
        action: "createBucket",
      })
      return null
    }
  } else if (bucketResult.data && !bucketResult.data.public) {
    await supabase.storage.updateBucket(SUPABASE_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    })
  }

  const uploaded = await supabase.storage.from(SUPABASE_IMAGES_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  })
  if (uploaded.error) {
    videoLog.warn("supplier-media.supabase", { error: uploaded.error.message, path })
    return null
  }
  return supabase.storage.from(SUPABASE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}

async function uploadToVercelBlob(
  bytes: Buffer,
  key: string,
  contentType: string
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) return null

  const blob = await put(key, bytes, {
    access: "public",
    contentType,
    token,
  })
  return blob.url
}

/**
 * Persists supplier image/video for variants, Veo refs, etc.
 * Priority: R2 → Vercel Blob → AWS S3 → Supabase.
 */
export async function uploadSupplierMediaBuffer(params: {
  userId: string
  bytes: Buffer
  contentType: string
  ext: string
  kind: SupplierMediaKind
  filenameBase: string
  subfolder?: string
}): Promise<{ url: string; storage: string }> {
  const date = new Date().toISOString().slice(0, 10)
  const folder = params.subfolder ?? (params.kind === "video" ? "supplier-videos" : "supplier-media")
  const key = `${params.userId}/${folder}/${date}/${Date.now()}-${params.filenameBase}.${params.ext}`

  if (isR2Configured()) {
    const url = await uploadBufferToR2(params.bytes, key, params.contentType)
    return { url, storage: "r2" }
  }

  const blobUrl = await uploadToVercelBlob(params.bytes, key, params.contentType)
  if (blobUrl) return { url: blobUrl, storage: "vercel_blob" }

  const s3Url = await uploadToS3(params.bytes, key, params.contentType)
  if (s3Url) return { url: s3Url, storage: "s3" }

  const supabasePath = key
  const supabaseUrl = await uploadToSupabase(params.bytes, supabasePath, params.contentType)
  if (supabaseUrl) return { url: supabaseUrl, storage: "supabase" }

  throw new Error(SUPPLIER_MEDIA_STORAGE_UNAVAILABLE)
}
