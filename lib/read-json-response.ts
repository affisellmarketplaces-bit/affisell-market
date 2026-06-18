/** Safe JSON body read — avoids `res.json()` on empty 500/HTML error pages. */
export async function readJsonResponse<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text()
  if (!text.trim()) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    return {} as T
  }
}
