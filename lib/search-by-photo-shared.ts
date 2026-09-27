const MAX_QUERY_LEN = 120

/** Cleans the model's JSON-parsed response into a usable search query, or "" if unusable. */
export function sanitizeSearchByPhotoQuery(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.trim().slice(0, MAX_QUERY_LEN)
}

const MAX_DATA_URL_LEN = 1_400_000

/** Same allow-list as the supplier AI routes: a real image data URL, size-capped. */
export function isAllowedSearchByPhotoDataUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s) && s.length <= MAX_DATA_URL_LEN
}
