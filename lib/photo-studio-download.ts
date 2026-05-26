import JSZip from "jszip"

export async function downloadImagesAsZip(
  files: Array<{ url: string; filename: string }>,
  zipName = "affisell-studio-images.zip"
): Promise<void> {
  if (files.length === 0) return

  const zip = new JSZip()
  await Promise.all(
    files.map(async ({ url, filename }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch ${filename}`)
      const blob = await res.blob()
      zip.file(filename, blob)
    })
  )

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = objectUrl
  a.download = zipName
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

export function safeDownloadFilename(name: string, suffix = "jpg"): string {
  const base = name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 48)
  return `${base || "image"}.${suffix}`
}
