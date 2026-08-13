/** Safe JSON parse for Brand Studio AI fetch calls — never throws on empty body. */

export type BrandAiFetchResult<T> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

export async function postBrandAiJson<T>(
  url: string,
  body: unknown,
  fallbackError: string
): Promise<BrandAiFetchResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })

    const raw = await res.text()
    if (!raw.trim()) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: res.ok ? fallbackError : `${fallbackError} (HTTP ${res.status})`,
      }
    }

    let parsed: T & { error?: string }
    try {
      parsed = JSON.parse(raw) as T & { error?: string }
    } catch {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `${fallbackError} (invalid JSON)`,
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: parsed.error ?? fallbackError,
      }
    }

    return { ok: true, status: res.status, data: parsed, error: null }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : fallbackError,
    }
  }
}
