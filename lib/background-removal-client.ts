"use client"

/** Browser-only background removal (WASM). Never import from Server Components or API routes. */
export async function removeBackgroundFromFile(file: Blob): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal")
  return removeBackground(file)
}
