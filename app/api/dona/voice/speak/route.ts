import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { donaVoiceCapabilities, speakDonaText } from "@/lib/dona/voice-audio"
import { isDonaVoiceKillSwitched } from "@/lib/dona/voice-limits"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { toDonaSpeakableText } from "@/lib/dona/voice-speakable"

export const runtime = "nodejs"
export const maxDuration = 30
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (isDonaVoiceKillSwitched()) {
    return Response.json({ error: "dona_voice_disabled", fallback: "browser" }, { status: 503 })
  }

  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "dona-voice-tts",
    limit: 30,
    windowMs: 60_000,
  })
  if (limited) return limited

  const caps = donaVoiceCapabilities()
  if (!caps.neuralTts) {
    return new Response(null, { status: 204 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = body as { text?: unknown; locale?: unknown }
  const locale = resolveAppLocale(typeof parsed.locale === "string" ? parsed.locale : null)
  const text = toDonaSpeakableText(typeof parsed.text === "string" ? parsed.text : "")
  if (!text) {
    return Response.json({ error: "empty_text" }, { status: 400 })
  }

  try {
    const spoken = await speakDonaText(text, locale)
    if (!spoken) {
      return new Response(null, { status: 204 })
    }
    return new Response(Buffer.from(spoken.bytes), {
      status: 200,
      headers: {
        "Content-Type": spoken.contentType,
        "Cache-Control": "no-store",
        "X-Dona-Voice-Provider": spoken.provider,
      },
    })
  } catch (error) {
    console.error("[dona/voice/speak]", error instanceof Error ? error.message : String(error))
    return Response.json({ error: "speak_failed", fallback: "browser" }, { status: 502 })
  }
}
