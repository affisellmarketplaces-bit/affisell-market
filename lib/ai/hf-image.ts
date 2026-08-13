/** Optional Hugging Face inference for image generation (store avatars). */
export async function generateImageWithHf(prompt: string): Promise<Buffer | null> {
  const token = process.env.HF_TOKEN?.trim()
  if (!token || !prompt.trim()) return null

  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/sdxl-turbo",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt.slice(0, 2000) }),
        signal: AbortSignal.timeout(120_000),
      }
    )

    if (!res.ok) {
      console.log("[hf-image]", { result: "http_error", status: res.status })
      return null
    }

    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 0 ? buf : null
  } catch (err) {
    console.log("[hf-image]", {
      result: "error",
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
