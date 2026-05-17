/** Optional Hugging Face inference for image generation (store avatars). */
export async function generateImageWithHf(prompt: string): Promise<Buffer | null> {
  const token = process.env.HF_TOKEN?.trim()
  if (!token || !prompt.trim()) return null

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

  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.length > 0 ? buf : null
}
