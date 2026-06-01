/** Parse JSON pasted from AE DevTools (raw object, assignment, or copy()). */
export function parsePastedAerJson(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Collez le JSON catalogue AliExpress.")
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    /* try extraction */
  }

  const markers = [
    "window.__AER_DATA__ =",
    "window.__AER_DATA__=",
    "window.__INIT_DATA__ =",
    "var __AER_DATA__ =",
  ]
  for (const marker of markers) {
    const idx = trimmed.indexOf(marker)
    if (idx < 0) continue
    const start = idx + marker.length
    const parsed = parseBalancedJson(trimmed, start)
    if (parsed) return parsed
  }

  const firstBrace = trimmed.indexOf("{")
  if (firstBrace >= 0) {
    const parsed = parseBalancedJson(trimmed, firstBrace)
    if (parsed) return parsed
  }

  throw new Error(
    "JSON illisible — copiez avec : copy(JSON.stringify(window.__AER_DATA__)) dans la console AE."
  )
}

function parseBalancedJson(text: string, startIndex: number): unknown | null {
  let i = startIndex
  while (i < text.length && text[i] !== "{") i += 1
  if (i >= text.length) return null

  let depth = 0
  for (let j = i; j < text.length; j += 1) {
    const c = text[j]
    if (c === "{") depth += 1
    else if (c === "}") {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(i, j + 1)) as unknown
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/** One-liner for AE console — copies catalogue JSON to clipboard. */
export const AE_CONSOLE_COPY_SNIPPET =
  "copy(JSON.stringify(window.__AER_DATA__||window.__INIT_DATA__||(window.runParams&&window.runParams.data)||window.runParams))"
