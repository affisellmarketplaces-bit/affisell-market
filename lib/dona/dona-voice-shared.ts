import type { AppLocale } from "@/lib/i18n-locale"

/** BCP-47 tag for Web Speech Recognition / Synthesis. */
export function donaSpeechLang(locale: AppLocale): string {
  switch (locale) {
    case "fr":
      return "fr-FR"
    case "de":
      return "de-DE"
    case "es":
      return "es-ES"
    case "it":
      return "it-IT"
    case "nl":
      return "nl-NL"
    case "pl":
      return "pl-PL"
    case "zh":
      return "zh-CN"
    case "en":
    default:
      return "en-US"
  }
}

/** Strip markdown / noise so TTS sounds natural. */
export function donaTextForSpeech(raw: string): string {
  let text = raw.trim()
  if (!text) return ""

  text = text.replace(/```[\s\S]*?```/g, " ")
  text = text.replace(/`([^`]+)`/g, "$1")
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
  text = text.replace(/https?:\/\/\S+/gi, " ")
  text = text.replace(/^#{1,6}\s+/gm, "")
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2")
  text = text.replace(/(\*|_)(.*?)\1/g, "$2")
  text = text.replace(/^>\s+/gm, "")
  text = text.replace(/^[-*+]\s+/gm, "")
  text = text.replace(/^\d+\.\s+/gm, "")
  // Soften emoji clusters for clearer speech
  text = text.replace(/\p{Extended_Pictographic}/gu, " ")
  text = text.replace(/\s+/g, " ").trim()

  // Cap length — long catalog dumps shouldn't monopolize speakers
  if (text.length > 900) {
    text = `${text.slice(0, 880).trim()}…`
  }
  return text
}

export type DonaSpeechSupport = {
  stt: boolean
  tts: boolean
}

export function detectDonaSpeechSupport(
  win: Window | undefined = typeof window !== "undefined" ? window : undefined
): DonaSpeechSupport {
  if (!win) return { stt: false, tts: false }
  const w = win as Window & {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
    speechSynthesis?: SpeechSynthesis
  }
  const stt = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
  const tts = typeof w.speechSynthesis?.speak === "function"
  return { stt, tts }
}

type SpeechVoiceLike = { lang: string; name: string; localService?: boolean }

/** Prefer a natural local voice matching the locale (often female onboard assistants). */
export function pickDonaTtsVoice(
  voices: SpeechVoiceLike[],
  locale: AppLocale
): SpeechVoiceLike | null {
  if (voices.length === 0) return null
  const lang = donaSpeechLang(locale).toLowerCase()
  const primary = lang.slice(0, 2)

  const scored = voices.map((voice) => {
    const vLang = voice.lang.toLowerCase()
    let score = 0
    if (vLang === lang) score += 50
    else if (vLang.startsWith(primary)) score += 30
    if (voice.localService) score += 8
    const name = voice.name.toLowerCase()
    if (
      /female|woman|amélie|amelie|thomas|google.*(français|french)|samantha|karen|moira|aria|jenny|natasha|helen|victoria|zira|denise|hortense/.test(
        name
      )
    ) {
      score += 12
    }
    if (/male|david|mark|fred|daniel|george/.test(name)) score -= 6
    return { voice, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.score && scored[0].score > 0 ? scored[0].voice : voices[0] ?? null
}

export const DONA_VOICE_DUPLEX_STORAGE_KEY = "affisell_dona_voice_duplex"

export function readDonaVoiceDuplexPref(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(DONA_VOICE_DUPLEX_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function writeDonaVoiceDuplexPref(on: boolean): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(DONA_VOICE_DUPLEX_STORAGE_KEY, on ? "1" : "0")
  } catch {
    // private mode / quota — ignore
  }
}
