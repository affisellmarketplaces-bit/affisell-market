import DOMPurify from "isomorphic-dompurify"

/** Strip HTML; collapse whitespace for safe review text storage. */
export function sanitizeReviewText(input: string, maxLen: number): string {
  const stripped = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
  return stripped.replace(/\s+/g, " ").trim().slice(0, maxLen)
}
