/**
 * Turn a Dona chat reply into something a TTS engine can speak without
 * reading markdown, URLs, or tool-dump noise.
 */

export const DONA_VOICE_MAX_SPEAK_CHARS = 480

const URL_RE = /https?:\/\/\S+|www\.\S+/gi
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const MD_NOISE_RE = /[*_~`#>]/g
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu

export function toDonaSpeakableText(raw: string, maxChars = DONA_VOICE_MAX_SPEAK_CHARS): string {
  const compact = raw
    .replace(MD_LINK_RE, "$1")
    .replace(URL_RE, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}\d+\.\s+/gm, "")
    .replace(MD_NOISE_RE, "")
    .replace(EMOJI_RE, "")
    .replace(/\s+/g, " ")
    .trim()

  if (!compact) return ""
  if (compact.length <= maxChars) return compact

  const sliced = compact.slice(0, maxChars)
  const lastStop = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf("! "), sliced.lastIndexOf("? "))
  if (lastStop >= 80) return sliced.slice(0, lastStop + 1).trim()
  return `${sliced.trim()}…`
}

export function isDonaVoiceModeFlag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1"
}
