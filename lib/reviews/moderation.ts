import OpenAI from "openai"

export type ModerationOutcome = {
  flagged: boolean
  aiScore: number | null
  moderationNote: string | null
  categories: string[]
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

/** OpenAI moderation + simple quality heuristic (0 = safe, 1 = spam). */
export async function moderateReviewText(title: string | null, body: string): Promise<ModerationOutcome> {
  const client = getOpenAI()
  const combined = [title, body].filter(Boolean).join("\n\n").trim()
  if (!client) {
    return { flagged: false, aiScore: null, moderationNote: null, categories: [] }
  }

  try {
    const res = await client.moderations.create({ model: "omni-moderation-latest", input: combined })
    const r = res.results[0]
    if (!r) {
      return { flagged: false, aiScore: null, moderationNote: null, categories: [] }
    }
    const cats = Object.entries(r.categories)
      .filter(([, v]) => v)
      .map(([k]) => k)
    const flagged = r.flagged
    const maxScore = Math.max(...Object.values(r.category_scores).map(Number), 0)
    const aiScore = flagged ? Math.min(1, maxScore) : Math.min(0.35, maxScore * 0.5)
    return {
      flagged,
      aiScore,
      moderationNote: flagged ? `OpenAI moderation: ${cats.join(", ") || "policy"}` : null,
      categories: cats,
    }
  } catch (e) {
    console.error("[reviews] moderation failed", e)
    return { flagged: false, aiScore: null, moderationNote: "moderation_skipped", categories: [] }
  }
}
