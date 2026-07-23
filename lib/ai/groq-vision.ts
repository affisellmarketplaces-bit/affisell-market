import type Groq from "groq-sdk"

/** Groq vision models — max images per request (Qwen 3.6 allows up to 5). */
export const GROQ_VISION_MAX_IMAGES = 4

export function countVisionImagesInMessages(
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[]
): number {
  let n = 0
  for (const m of messages) {
    const content = m.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        (part as { type?: string }).type === "image_url"
      ) {
        n++
      }
    }
  }
  return n
}

type ContentPart = Groq.Chat.Completions.ChatCompletionContentPart

function isImagePart(part: ContentPart): part is Groq.Chat.Completions.ChatCompletionContentPartImage {
  return part.type === "image_url"
}

/** Ensures vision requests never exceed {@link GROQ_VISION_MAX_IMAGES}. */
export function capVisionImagesInMessages(
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[],
  max: number = GROQ_VISION_MAX_IMAGES
): Groq.Chat.Completions.ChatCompletionMessageParam[] {
  let remaining = max
  return messages.map((m) => {
    if (!Array.isArray(m.content) || remaining <= 0) return m

    const nextParts: ContentPart[] = []
    for (const part of m.content) {
      if (isImagePart(part)) {
        if (remaining <= 0) continue
        remaining--
      }
      nextParts.push(part)
    }
    return { ...m, content: nextParts } as Groq.Chat.Completions.ChatCompletionMessageParam
  })
}

export function isGroqRateLimitError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status
    if (status === 429 || status === 413) return true
  }
  const raw =
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err)
  return /rate limit|rate_limit|429|tokens per day|tokens per minute|too many requests/i.test(raw)
}

export function normalizeGroqClientError(err: unknown): Error {
  if (isGroqRateLimitError(err)) {
    return new Error(
      "Quota IA Groq atteint pour aujourd'hui. Réessayez demain — vos textes et images restent enregistrés."
    )
  }

  const raw =
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err)

  if (/too many images/i.test(raw)) {
    return new Error(
      "Trop d'images pour l'IA (maximum 4). Gardez au plus 3–4 illustrations ou retirez des photos galerie."
    )
  }

  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } }
    const inner = parsed.error?.message
    if (inner && /too many images/i.test(inner)) {
      return new Error(
        "Trop d'images pour l'IA (maximum 4). Gardez au plus 3–4 illustrations ou retirez des photos galerie."
      )
    }
    if (inner && isGroqRateLimitError({ message: inner })) {
      return new Error(
        "Quota IA Groq atteint pour aujourd'hui. Réessayez demain — vos textes et images restent enregistrés."
      )
    }
    if (inner && /model_not_found|does not exist|not have access/i.test(inner)) {
      return new Error("Modèle IA Groq indisponible. Réessayez — bascule automatique en cours.")
    }
    if (inner) return new Error(inner)
  } catch {
    /* not json */
  }

  if (/model_not_found|does not exist|not have access/i.test(raw)) {
    return new Error("Modèle IA Groq indisponible. Réessayez — bascule automatique en cours.")
  }

  return err instanceof Error ? err : new Error(raw)
}
