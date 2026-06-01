/** Client upload for supplier variant / product videos (Supabase public URL). */

const MAX_VIDEO_BYTES = 48 * 1024 * 1024

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i

export function isSupplierVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true
  return VIDEO_EXT.test(file.name)
}

export async function uploadSupplierVideoFile(file: File): Promise<string> {
  if (!isSupplierVideoFile(file)) {
    throw new Error("Format accepté : MP4, WebM ou MOV")
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Vidéo trop lourde (max 48 Mo)")
  }
  if (file.size === 0) {
    throw new Error("Fichier vide")
  }

  const form = new FormData()
  form.append("file", file)

  const res = await fetch("/api/supplier/upload-media", {
    method: "POST",
    credentials: "include",
    body: form,
  })

  const data = (await res.json()) as { url?: string; error?: string; detail?: string }
  if (!res.ok || !data.url?.trim()) {
    throw new Error(data.error ?? data.detail ?? "Upload échoué")
  }

  return data.url.trim()
}
