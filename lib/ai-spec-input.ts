/**
 * Input of the "fill the specs of this product" AI routes (`/api/ai/fill-specs`, `/api/ai/suggest-specs`).
 *
 * Both used to forward whatever they were given to a paid vision model. The image is accepted as an https URL or a
 * JPEG/PNG/WebP data URL only (no http:, no file:, no credentials in the URL), and every field has a size cap.
 */

export const SPECS_AI_MAX_TITLE_CHARS = 300
export const SPECS_AI_MAX_URL_CHARS = 2048
export const SPECS_AI_MAX_DATA_URL_CHARS = 4_000_000

const DATA_IMAGE_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/

export type SpecsAiInput = { productTitle?: string; imageUrl?: string }

export type SpecsAiParsed = { ok: true; input: SpecsAiInput } | { ok: false; error: string }

function isAcceptableImageUrl(url: string): boolean {
  if (url.startsWith("data:")) {
    return url.length <= SPECS_AI_MAX_DATA_URL_CHARS && DATA_IMAGE_URL.test(url)
  }
  if (url.length > SPECS_AI_MAX_URL_CHARS) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

export function parseSpecsAiInput(body: unknown): SpecsAiParsed {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {}

  const productTitle = typeof raw.productTitle === "string" ? raw.productTitle.trim() : ""
  const imageUrl = typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : ""

  if (!productTitle && !imageUrl) {
    return { ok: false, error: "Either productTitle or imageUrl is required" }
  }
  if (productTitle.length > SPECS_AI_MAX_TITLE_CHARS) {
    return { ok: false, error: "productTitle is too long" }
  }
  if (imageUrl && !isAcceptableImageUrl(imageUrl)) {
    return { ok: false, error: "imageUrl must be an https URL or a JPEG/PNG/WebP data URL" }
  }

  return {
    ok: true,
    input: {
      ...(productTitle ? { productTitle } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    },
  }
}
