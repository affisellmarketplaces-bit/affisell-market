/** Server-style square canvas for marketplace product shots (used by supplier upload UI). */

export const PRODUCT_IMAGE_CANVAS = 1200
export const PRODUCT_IMAGE_PAD = 120

export async function measureImageFile(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const el = new window.Image()
      el.onload = () => resolve({ width: el.width, height: el.height })
      el.onerror = () => reject(new Error("dim"))
      el.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function processProductImageToDataUrl(file: File): Promise<string> {
  const { removeBackgroundFromFile } = await import("@/lib/background-removal-client")
  const blob = await removeBackgroundFromFile(file)

  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(blob)
    const img = new window.Image()
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = PRODUCT_IMAGE_CANVAS
        canvas.height = PRODUCT_IMAGE_CANVAS
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("No canvas"))
          return
        }

        ctx.fillStyle = "#F5F5F5"
        ctx.fillRect(0, 0, PRODUCT_IMAGE_CANVAS, PRODUCT_IMAGE_CANVAS)

        const maxSize = PRODUCT_IMAGE_CANVAS - PRODUCT_IMAGE_PAD * 2
        const scale = Math.min(maxSize / img.width, maxSize / img.height)
        const width = img.width * scale
        const height = img.height * scale
        const x = (PRODUCT_IMAGE_CANVAS - width) / 2
        const y = (PRODUCT_IMAGE_CANVAS - height) / 2

        ctx.drawImage(img, x, y, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.9))
      } finally {
        URL.revokeObjectURL(blobUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      reject(new Error("decode"))
    }
    img.src = blobUrl
  })
}
