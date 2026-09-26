import type { AppLocale } from "@/lib/i18n-locale"

/** Dona is a woman — never ship a male or androgynous TTS identity. */
export const DONA_OPENAI_DEFAULT_VOICE = "coral"
export const DONA_GROQ_DEFAULT_VOICE = "Arista-PlayAI"

const OPENAI_FEMALE = new Set(["coral", "nova", "shimmer", "sage", "marin", "ballad"])
const OPENAI_MALE = new Set(["echo", "onyx", "fable", "ash", "verse", "cedar", "alloy"])

const GROQ_FEMALE = new Set([
  "Arista-PlayAI",
  "Celeste-PlayAI",
  "Cheyenne-PlayAI",
  "Deedee-PlayAI",
  "Jennifer-PlayAI",
  "Judy-PlayAI",
  "Matilda-PlayAI",
  "Quinn-PlayAI",
])

const BROWSER_FEMALE_RE =
  /female|woman|femme|samantha|amélie|amelie|audrey|virginie|marie|hortense|julie|denise|victoria|karen|moira|fiona|tessa|serena|susan|zira|aria|jenny|sonia|paulina|paloma|mónica|monica|elsa|alice|anna|petra|hedda|ellen|zosia|ting|yaoyao|kyoko|meijia|nari|google uk english female|google us english female|google français female|microsoft hortense|microsoft julie/i

const BROWSER_MALE_RE =
  /male|\bman\b|homme|thomas|nicolas|daniel|david|mark|\btom\b|fred|alex|jorge|pablo|diego|ravi|yannick|nathan|arthur|pierre|louis|hugo|\bpaul\b|\bluc\b|\bmax\b|xander|google français(?! female)|google deutsch(?! female)|baritone|onyx|echo|fable/i

export const DONA_TTS_INSTRUCTIONS =
  "Speak as Dona, a woman in her early thirties. Warm, clear, slightly dry European female voice. Never sound male, robotic, or androgynous. Conversational, close-mic, natural cadence."

export function resolveDonaOpenAiVoice(raw?: string | null): string {
  const v = (raw ?? "").trim().toLowerCase()
  if (OPENAI_FEMALE.has(v)) return v
  if (v && OPENAI_MALE.has(v)) {
    console.warn("[dona-voice]", { result: "male_voice_remapped", from: v, to: DONA_OPENAI_DEFAULT_VOICE })
  }
  return DONA_OPENAI_DEFAULT_VOICE
}

export function resolveDonaGroqVoice(raw?: string | null): string {
  const v = (raw ?? "").trim()
  if (GROQ_FEMALE.has(v)) return v
  if (v && v !== DONA_GROQ_DEFAULT_VOICE) {
    console.warn("[dona-voice]", { result: "male_voice_remapped", from: v, to: DONA_GROQ_DEFAULT_VOICE })
  }
  return DONA_GROQ_DEFAULT_VOICE
}

export function donaTtsModelChain(raw?: string | null): string[] {
  const preferred = raw?.trim() || "gpt-4o-mini-tts"
  const chain = preferred.startsWith("tts-1")
    ? [preferred, "gpt-4o-mini-tts"]
    : [preferred, "tts-1"]
  return [...new Set(chain)]
}

export function localeToBcp47(locale: AppLocale): string {
  if (locale === "zh") return "zh-CN"
  if (locale === "en") return "en-US"
  return locale
}

export type DonaBrowserVoiceLike = {
  name: string
  lang: string
  localService?: boolean
}

export function isFeminineBrowserVoice(voice: DonaBrowserVoiceLike): boolean {
  const n = `${voice.name} ${voice.lang}`
  if (BROWSER_MALE_RE.test(n) && !/female|femme|woman/i.test(n)) return false
  return BROWSER_FEMALE_RE.test(n)
}

export function scoreDonaBrowserVoice(voice: DonaBrowserVoiceLike, locale: AppLocale): number {
  const prefix = localeToBcp47(locale).slice(0, 2).toLowerCase()
  const n = `${voice.name} ${voice.lang}`
  let score = 0
  if (voice.lang.toLowerCase().startsWith(prefix)) score += 25
  if (isFeminineBrowserVoice(voice)) score += 60
  if (BROWSER_MALE_RE.test(n) && !/female|femme|woman/i.test(n)) score -= 100
  if (/neural|premium|enhanced|natural/.test(n.toLowerCase())) score += 6
  if (voice.localService) score += 2
  return score
}

export function pickDonaBrowserVoice<T extends DonaBrowserVoiceLike>(
  voices: T[],
  locale: AppLocale
): T | null {
  if (!voices.length) return null
  const ranked = [...voices].sort(
    (a, b) => scoreDonaBrowserVoice(b, locale) - scoreDonaBrowserVoice(a, locale)
  )
  const feminine = ranked.filter((v) => isFeminineBrowserVoice(v))
  return (feminine[0] ?? ranked[0]) ?? null
}

export function donaBrowserPitch(voice: DonaBrowserVoiceLike | null): number {
  if (voice && isFeminineBrowserVoice(voice)) return 1.08
  return 1.22
}
