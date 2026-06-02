import "server-only"

import { put } from "@vercel/blob"

import type { MerchantDocumentType } from "@/lib/merchant-legal/merchant-legal-status-shared"

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

export function validateSignupDocumentFile(file: File): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return { ok: false, error: "file_size_invalid" }
  }
  const mime = file.type?.trim() || "application/octet-stream"
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "file_type_invalid" }
  }
  return { ok: true }
}

function extensionForMime(mime: string): string {
  if (mime === "application/pdf") return "pdf"
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "jpg"
}

export async function storeSignupDocumentDraft(
  draftId: string,
  documentType: MerchantDocumentType,
  file: File
): Promise<{ url: string; mimeType: string; fileName: string; fileSizeBytes: number }> {
  const check = validateSignupDocumentFile(file)
  if (!check.ok) throw new Error(check.error)

  const mime = file.type.trim()
  const ext = extensionForMime(mime)
  const bytes = Buffer.from(await file.arrayBuffer())
  const key = `signup-drafts/${draftId}/${documentType.toLowerCase()}.${ext}`

  const blob = await put(key, bytes, {
    access: "public",
    contentType: mime,
    addRandomSuffix: false,
  })

  return {
    url: blob.url,
    mimeType: mime,
    fileName: file.name.slice(0, 200),
    fileSizeBytes: file.size,
  }
}
