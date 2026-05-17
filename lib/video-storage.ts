import { put } from "@vercel/blob"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"

import { videoLog } from "@/lib/video-logger"

const VIDEO_BUCKET = "product-videos"

function getS3Client(): S3Client | null {
  const region = process.env.AWS_REGION?.trim()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()
  if (!region || !accessKeyId || !secretAccessKey) return null
  return new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })
}

function publicS3Url(bucket: string, region: string, key: string): string {
  const enc = encodeURIComponent(key).replace(/%2F/g, "/")
  return `https://${bucket}.s3.${region}.amazonaws.com/${enc}`
}

/** Upload MP4 to Vercel Blob (`videos/{operationId}.mp4`). */
export async function uploadVideoToVercelBlob(bytes: Buffer, operationId: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN for video upload.")
  }

  const blob = await put(`videos/${operationId}.mp4`, bytes, {
    access: "public",
    contentType: "video/mp4",
    token,
  })
  return blob.url
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

async function uploadToSupabase(bytes: Buffer, path: string, contentType: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null

  const supabase = createClient(url, key)
  const uploaded = await supabase.storage.from(VIDEO_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  })
  if (uploaded.error) {
    videoLog.warn("Supabase video upload failed", { error: uploaded.error.message })
    return null
  }
  return supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Persist generated MP4; prefers Vercel Blob, then S3, then Supabase. */
export async function uploadGeneratedVideo(
  bytes: Buffer,
  opts: { productId: string; jobId: string }
): Promise<string> {
  const operationId = opts.jobId
  try {
    return await uploadVideoToVercelBlob(bytes, operationId)
  } catch (e) {
    if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) throw e
    videoLog.warn("Vercel Blob skipped", { error: e instanceof Error ? e.message : String(e) })
  }

  const contentType = "video/mp4"
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${opts.productId}/${date}/${operationId}.mp4`

  const s3Url = await uploadToS3(bytes, `videos/${filename}`, contentType)
  if (s3Url) return s3Url

  const supabaseUrl = await uploadToSupabase(bytes, filename, contentType)
  if (supabaseUrl) return supabaseUrl

  throw new Error(
    "No video storage configured. Set BLOB_READ_WRITE_TOKEN, or AWS S3, or Supabase (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."
  )
}
