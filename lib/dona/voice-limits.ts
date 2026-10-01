export const DONA_VOICE_MAX_AUDIO_BYTES = 4 * 1024 * 1024
export const DONA_VOICE_MAX_AUDIO_MS = 20_000
export const DONA_VOICE_ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/aac",
])

export function isDonaVoiceKillSwitched(): boolean {
  const raw = process.env.DONA_VOICE_DISABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function normalizeAudioMime(mime: string | undefined): string {
  const base = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? ""
  if (base === "audio/mp3") return "audio/mpeg"
  return base
}

export function isAllowedDonaAudioMime(mime: string | undefined): boolean {
  const raw = (mime ?? "").trim().toLowerCase()
  if (DONA_VOICE_ALLOWED_MIME.has(raw)) return true
  const base = normalizeAudioMime(raw)
  return DONA_VOICE_ALLOWED_MIME.has(base)
}

export function whisperLanguageFromLocale(locale: string): string {
  const tag = locale.trim().toLowerCase()
  if (tag.startsWith("zh")) return "zh"
  return tag.slice(0, 2)
}
