import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const DEFAULT_BUCKET = "affisell"

let cachedClient: S3Client | null | undefined

/** Test-only: clear cached S3 client after env changes. */
export function resetR2ClientCache(): void {
  cachedClient = undefined
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_ENDPOINT?.trim() &&
      process.env.R2_PUBLIC_URL?.trim()
  )
}

export function getR2Client(): S3Client | null {
  if (cachedClient !== undefined) return cachedClient

  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const endpoint = process.env.R2_ENDPOINT?.trim()

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    cachedClient = null
    return null
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })
  return cachedClient
}

export function r2BucketName(): string {
  return process.env.R2_BUCKET_NAME?.trim() || DEFAULT_BUCKET
}

export function publicUrlForR2Key(key: string): string {
  const base = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, "") ?? ""
  const path = key.replace(/^\//, "")
  return `${base}/${path}`
}

export async function uploadBufferToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getR2Client()
  if (!client) {
    throw new Error("R2 is not configured (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_PUBLIC_URL)")
  }

  await client.send(
    new PutObjectCommand({
      Bucket: r2BucketName(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  return publicUrlForR2Key(key)
}
