/**
 * Truncation that never cuts an emoji in half.
 *
 * Emoji and many CJK characters are two UTF-16 units (a surrogate pair). `text.slice(0, n)` can end between the two,
 * leaving a lone surrogate: the server serializes it to the replacement character U+FFFD while the client keeps the raw
 * unit, so React reports a hydration mismatch (and users see a "�"). Marketplace descriptions and titles are full of
 * emoji, so every user-text cut that is rendered must go through here.
 */

/** `text.slice(0, end)`, backing off one unit when the cut would split a surrogate pair. Same units as `slice`. */
export function sliceSafe(text: string, end: number): string {
  if (end >= text.length) return text
  if (end <= 0) return ""
  const last = text.charCodeAt(end - 1)
  const splitsPair = last >= 0xd800 && last <= 0xdbff
  return text.slice(0, splitsPair ? end - 1 : end)
}

/** At most `max` units, with `ellipsis` appended only when something was cut. */
export function truncateText(text: string, max: number, ellipsis = "…"): string {
  return text.length > max ? `${sliceSafe(text, max)}${ellipsis}` : text
}
