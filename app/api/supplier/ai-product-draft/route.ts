import { auth } from "@/auth"
import { groqChatText, GROQ_VISION_MODEL } from "@/lib/ai/groq-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CharDef = {
  key: string
  label: string
  type: string
  options: string[]
  required: boolean
}

function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return t
}

const MAX_DATA_URL_LEN = 1_400_000
const MAX_DATA_URLS = 4

function isAllowedDataImageUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s) && s.length <= MAX_DATA_URL_LEN
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    return Response.json({ error: "AI is not configured (missing GROQ_API_KEY)." }, { status: 503 })
  }

  let body: {
    name?: unknown
    description?: unknown
    imageUrls?: unknown
    imageDataUrls?: unknown
    categoryPath?: unknown
    characteristics?: unknown
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const notes = typeof body.description === "string" ? body.description.trim() : ""
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls
        .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u.trim()))
        .map((u) => u.trim().slice(0, 2000))
        .slice(0, 4)
    : []

  const imageDataUrls = Array.isArray(body.imageDataUrls)
    ? body.imageDataUrls
        .filter((u): u is string => typeof u === "string" && isAllowedDataImageUrl(u.trim()))
        .map((u) => u.trim())
        .slice(0, MAX_DATA_URLS)
    : []

  const categoryPath =
    typeof body.categoryPath === "string" ? body.categoryPath.trim().slice(0, 500) : ""

  const charsRaw = body.characteristics
  const characteristics: CharDef[] = []
  if (Array.isArray(charsRaw)) {
    for (const row of charsRaw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue
      const o = row as Record<string, unknown>
      const key = typeof o.key === "string" ? o.key.trim() : ""
      if (!key) continue
      characteristics.push({
        key: key.slice(0, 80),
        label: typeof o.label === "string" ? o.label.trim().slice(0, 120) : key,
        type: typeof o.type === "string" ? o.type.trim().toUpperCase() : "TEXT",
        options: Array.isArray(o.options)
          ? o.options.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 200))
          : [],
        required: o.required === true,
      })
    }
  }

  if (name.length < 2 && notes.length < 8 && imageUrls.length === 0 && imageDataUrls.length === 0) {
    return Response.json(
      { error: "Add a title, notes, at least one image URL, or upload photos in the dialog." },
      { status: 400 }
    )
  }

  const charLines = characteristics.map((c) => {
    const req = c.required ? "required" : "optional"
    if (c.type === "SELECT" && c.options.length > 0) {
      return `- ${c.key} (${c.label}, ${req}, SELECT): value must be exactly one of: ${c.options.join(" | ")}`
    }
    if (c.type === "NUMBER") {
      return `- ${c.key} (${c.label}, ${req}, NUMBER): numeric string only`
    }
    return `- ${c.key} (${c.label}, ${req}, TEXT)`
  })

  const schemaHint = `Return a single JSON object with keys:
- "description" (string, plain text, no HTML/Markdown, max ~3500 chars): buyer- and affiliate-oriented listing copy. Stay factual; do not invent certifications or reviews.
- "specs" (object): optional key-value pairs ONLY for characteristic keys listed below. Omit keys you cannot infer.`

  const imageHint =
    imageUrls.length > 0
      ? `\nAdditional product image URLs (context only):\n${imageUrls.join("\n")}`
      : ""

  const visionHint =
    imageDataUrls.length > 0
      ? "\nYou are given one or more product photos attached to this message. Use them together with the text fields to infer accurate details."
      : ""

  const userMessage = [
    `Product name: ${name || "(none)"}`,
    `Category path: ${categoryPath || "(none)"}`,
    `Supplier notes / draft description: ${notes || "(none)"}`,
    imageHint,
    visionHint,
    characteristics.length
      ? `Characteristics (keys for "specs" object):\n${charLines.join("\n")}`
      : `No structured characteristics for this category.`,
    schemaHint,
    `Respond with JSON only, no prose outside the JSON.`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const useVision = imageDataUrls.length > 0
  const userContent:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = useVision
    ? [
        { type: "text", text: userMessage },
        ...imageDataUrls.map((url) => ({
          type: "image_url" as const,
          image_url: { url },
        })),
      ]
    : userMessage

  try {
    const raw =
      (await groqChatText({
        model: useVision ? GROQ_VISION_MODEL : undefined,
        vision: useVision,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You draft marketplace product listings for Affisell suppliers. Output is always valid JSON per the user instructions.",
          },
          { role: "user", content: userContent },
        ],
      })) ?? "{}"
    let parsed: { description?: unknown; specs?: unknown }
    try {
      parsed = JSON.parse(stripJsonFence(raw)) as { description?: unknown; specs?: unknown }
    } catch {
      return Response.json({ error: "Model returned invalid JSON" }, { status: 502 })
    }

    const description =
      typeof parsed.description === "string" ? parsed.description.trim().slice(0, 8000) : ""
    if (!description) {
      return Response.json({ error: "Model returned an empty description" }, { status: 502 })
    }

    const specsOut: Record<string, string> = {}
    const allowed = new Set(characteristics.map((c) => c.key))
    const byKey = new Map<string, CharDef>(characteristics.map((c): [string, CharDef] => [c.key, c]))

    if (parsed.specs && typeof parsed.specs === "object" && !Array.isArray(parsed.specs)) {
      for (const [k, v] of Object.entries(parsed.specs as Record<string, unknown>)) {
        if (!allowed.has(k)) continue
        const def = byKey.get(k)
        const str = typeof v === "string" ? v.trim() : String(v ?? "").trim()
        if (!str || !def) continue
        if (def.type === "SELECT" && def.options.length > 0) {
          const ok = def.options.some((o) => o.toLowerCase() === str.toLowerCase())
          if (ok) {
            const exact = def.options.find((o) => o.toLowerCase() === str.toLowerCase()) ?? str
            specsOut[k] = exact
          }
        } else if (def.type === "NUMBER") {
          if (Number.isFinite(Number(str.replace(",", ".")))) specsOut[k] = str.replace(",", ".")
        } else {
          specsOut[k] = str.slice(0, 500)
        }
      }
    }

    return Response.json({ description, specs: specsOut })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "AI request failed" },
      { status: 504 }
    )
  }
}
