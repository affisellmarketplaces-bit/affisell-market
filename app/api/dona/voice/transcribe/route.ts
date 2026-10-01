import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { donaVoiceCapabilities, transcribeDonaAudio } from "@/lib/dona/voice-audio"
import {
  DONA_VOICE_MAX_AUDIO_BYTES,
  isAllowedDonaAudioMime,
  isDonaVoiceKillSwitched,
} from "@/lib/dona/voice-limits"
import { resolveAppLocale } from "@/lib/i18n-locale"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (isDonaVoiceKillSwitched()) {
    return Response.json({ error: "dona_voice_disabled" }, { status: 503 })
  }

  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "dona-voice-stt",
    limit: 20,
    windowMs: 60_000,
  })
  if (limited) return limited

  const caps = donaVoiceCapabilities()
  if (!caps.neuralStt) {
    return Response.json({ error: "dona_voice_stt_unavailable", fallback: "browser" }, { status: 503 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 })
  }

  const locale = resolveAppLocale(
    typeof form.get("locale") === "string" ? String(form.get("locale")) : null
  )
  const file = form.get("file")
  if (!(file instanceof File) || file.size < 800) {
    return Response.json({ error: "Expected audio file" }, { status: 400 })
  }
  if (file.size > DONA_VOICE_MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio_too_large" }, { status: 413 })
  }
  if (file.type && !isAllowedDonaAudioMime(file.type)) {
    return Response.json({ error: "unsupported_audio_type" }, { status: 415 })
  }

  try {
    const { text, provider } = await transcribeDonaAudio(file, locale)
    return Response.json({ text, provider, locale })
  } catch (error) {
    console.error("[dona/voice/transcribe]", error instanceof Error ? error.message : String(error))
    return Response.json({ error: "transcribe_failed", fallback: "browser" }, { status: 502 })
  }
}
