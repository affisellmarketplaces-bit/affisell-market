import "server-only"

import OpenAI from "openai"

import { createGroqClient, getGroqApiKey } from "@/lib/ai/groq-client"
import { logBusiness } from "@/lib/business-log"
import type { AppLocale } from "@/lib/i18n-locale"
import { isDonaVoiceKillSwitched, whisperLanguageFromLocale } from "@/lib/dona/voice-limits"
import { toDonaSpeakableText } from "@/lib/dona/voice-speakable"

const GROQ_WHISPER_MODEL = process.env.DONA_WHISPER_MODEL?.trim() || "whisper-large-v3-turbo"
const GROQ_TTS_MODEL = process.env.DONA_GROQ_TTS_MODEL?.trim() || "playai-tts"
const GROQ_TTS_VOICE = process.env.DONA_GROQ_TTS_VOICE?.trim() || "Arista-PlayAI"
const OPENAI_TTS_MODEL = process.env.DONA_TTS_MODEL?.trim() || "tts-1"
const OPENAI_TTS_VOICE = process.env.DONA_TTS_VOICE?.trim() || "nova"

export type DonaVoiceCapabilities = {
  enabled: boolean
  neuralStt: boolean
  neuralTts: boolean
}

export function donaVoiceCapabilities(): DonaVoiceCapabilities {
  if (isDonaVoiceKillSwitched()) {
    return { enabled: false, neuralStt: false, neuralTts: false }
  }
  const groq = Boolean(getGroqApiKey())
  const openai = Boolean(process.env.OPENAI_API_KEY?.trim())
  return {
    enabled: true,
    neuralStt: groq || openai,
    neuralTts: openai || groq,
  }
}

function openaiClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

export async function transcribeDonaAudio(file: File, locale: AppLocale): Promise<{
  text: string
  provider: "groq" | "openai"
}> {
  const language = whisperLanguageFromLocale(locale)

  const groq = createGroqClient()
  if (groq) {
    try {
      const result = await groq.audio.transcriptions.create({
        file,
        model: GROQ_WHISPER_MODEL,
        language,
        response_format: "json",
        temperature: 0,
      })
      const text = (result.text ?? "").trim()
      logBusiness("dona-voice", { result: "transcribe", provider: "groq", chars: text.length, locale })
      return { text, provider: "groq" }
    } catch (error) {
      console.error("[dona-voice]", {
        result: "transcribe_groq_fail",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const openai = openaiClient()
  if (openai) {
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language,
      response_format: "json",
      temperature: 0,
    })
    const text = (result.text ?? "").trim()
    logBusiness("dona-voice", { result: "transcribe", provider: "openai", chars: text.length, locale })
    return { text, provider: "openai" }
  }

  throw new Error("dona_voice_stt_unavailable")
}

export async function speakDonaText(
  raw: string,
  locale: AppLocale
): Promise<{ bytes: Uint8Array; contentType: string; provider: "openai" | "groq" } | null> {
  const text = toDonaSpeakableText(raw)
  if (!text) return null

  const openai = openaiClient()
  if (openai) {
    try {
      const speech = await openai.audio.speech.create({
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        input: text,
        response_format: "mp3",
        speed: 1.04,
      })
      const bytes = new Uint8Array(await speech.arrayBuffer())
      logBusiness("dona-voice", {
        result: "speak",
        provider: "openai",
        chars: text.length,
        locale,
        bytes: bytes.byteLength,
      })
      return { bytes, contentType: "audio/mpeg", provider: "openai" }
    } catch (error) {
      console.error("[dona-voice]", {
        result: "speak_openai_fail",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // PlayAI on Groq is English-quality; skip for non-EN if OpenAI already failed.
  const groqKey = getGroqApiKey()
  if (groqKey && (locale === "en" || !openai)) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_TTS_MODEL,
          voice: GROQ_TTS_VOICE,
          input: text,
          response_format: "mp3",
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => "")
        throw new Error(`groq_tts_${res.status} ${detail.slice(0, 180)}`)
      }
      const bytes = new Uint8Array(await res.arrayBuffer())
      logBusiness("dona-voice", {
        result: "speak",
        provider: "groq",
        chars: text.length,
        locale,
        bytes: bytes.byteLength,
      })
      return { bytes, contentType: "audio/mpeg", provider: "groq" }
    } catch (error) {
      console.error("[dona-voice]", {
        result: "speak_groq_fail",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return null
}
