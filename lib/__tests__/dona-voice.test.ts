import { describe, expect, it } from "vitest"

import { GET as getVoiceStatus } from "@/app/api/dona/voice/status/route"
import { POST as postTranscribe } from "@/app/api/dona/voice/transcribe/route"
import { POST as postSpeak } from "@/app/api/dona/voice/speak/route"
import { DONA_VOICE_MODE_PROMPT } from "@/lib/dona/voice-prompt"
import {
  DONA_VOICE_MAX_AUDIO_BYTES,
  isAllowedDonaAudioMime,
  isDonaVoiceKillSwitched,
  whisperLanguageFromLocale,
} from "@/lib/dona/voice-limits"
import {
  DONA_OPENAI_DEFAULT_VOICE,
  donaBrowserPitch,
  donaTtsModelChain,
  isFeminineBrowserVoice,
  pickDonaBrowserVoice,
  resolveDonaGroqVoice,
  resolveDonaOpenAiVoice,
} from "@/lib/dona/voice-identity"
import { isDonaVoiceModeFlag, toDonaSpeakableText } from "@/lib/dona/voice-speakable"

describe("dona voice speakable", () => {
  it("strips markdown links and urls so TTS does not spell them", () => {
    const spoken = toDonaSpeakableText(
      "Voici [le #1](https://www.affisell.com/marketplace/abc) 💜 voir https://www.affisell.com/discover"
    )
    expect(spoken.toLowerCase()).toContain("voici le")
    expect(spoken).not.toMatch(/https?:/)
    expect(spoken).not.toContain("💜")
  })

  it("returns empty for url-only noise", () => {
    expect(toDonaSpeakableText("https://affisell.com/marketplace/x")).toBe("")
  })

  it("truncates long answers on a sentence boundary", () => {
    const long = `${"Dona t'aide. ".repeat(80)}Fin.`
    const spoken = toDonaSpeakableText(long, 120)
    expect(spoken.length).toBeLessThanOrEqual(120)
    expect(spoken.endsWith(".")).toBe(true)
  })

  it("parses voiceMode flags", () => {
    expect(isDonaVoiceModeFlag(true)).toBe(true)
    expect(isDonaVoiceModeFlag("true")).toBe(true)
    expect(isDonaVoiceModeFlag(0)).toBe(false)
    expect(isDonaVoiceModeFlag(undefined)).toBe(false)
  })
})

describe("dona voice limits", () => {
  it("accepts common recorder mime types", () => {
    expect(isAllowedDonaAudioMime("audio/webm;codecs=opus")).toBe(true)
    expect(isAllowedDonaAudioMime("audio/mp4")).toBe(true)
    expect(isAllowedDonaAudioMime("audio/mp3")).toBe(true)
    expect(isAllowedDonaAudioMime("video/mp4")).toBe(false)
  })

  it("maps locales to whisper language", () => {
    expect(whisperLanguageFromLocale("fr")).toBe("fr")
    expect(whisperLanguageFromLocale("zh")).toBe("zh")
    expect(whisperLanguageFromLocale("en")).toBe("en")
  })

  it("keeps a 4MB audio cap", () => {
    expect(DONA_VOICE_MAX_AUDIO_BYTES).toBe(4 * 1024 * 1024)
  })

  it("kill switch is off by default", () => {
    expect(isDonaVoiceKillSwitched()).toBe(false)
  })
})

describe("dona feminine voice identity", () => {
  it("remaps male OpenAI voices to coral", () => {
    expect(resolveDonaOpenAiVoice("onyx")).toBe(DONA_OPENAI_DEFAULT_VOICE)
    expect(resolveDonaOpenAiVoice("echo")).toBe("coral")
    expect(resolveDonaOpenAiVoice("alloy")).toBe("coral")
    expect(resolveDonaOpenAiVoice("nova")).toBe("nova")
    expect(resolveDonaOpenAiVoice("CORAL")).toBe("coral")
  })

  it("keeps Groq on Arista, never Thunder", () => {
    expect(resolveDonaGroqVoice("Thunder-PlayAI")).toBe("Arista-PlayAI")
    expect(resolveDonaGroqVoice("Celeste-PlayAI")).toBe("Celeste-PlayAI")
  })

  it("prefers Amélie over Thomas in French", () => {
    const picked = pickDonaBrowserVoice(
      [
        { name: "Thomas", lang: "fr-FR" },
        { name: "Amélie", lang: "fr-FR" },
        { name: "Google US English", lang: "en-US" },
      ],
      "fr"
    )
    expect(picked?.name).toBe("Amélie")
    expect(isFeminineBrowserVoice({ name: "Thomas", lang: "fr-FR" })).toBe(false)
    expect(donaBrowserPitch({ name: "Thomas", lang: "fr-FR" })).toBeGreaterThan(
      donaBrowserPitch({ name: "Amélie", lang: "fr-FR" })
    )
  })

  it("picks a feminine English voice rather than a French man", () => {
    const picked = pickDonaBrowserVoice(
      [
        { name: "Thomas", lang: "fr-FR" },
        { name: "Samantha", lang: "en-US" },
      ],
      "fr"
    )
    expect(picked?.name).toBe("Samantha")
  })

  it("tries gpt-4o-mini-tts first so Dona can be directed as a woman", () => {
    expect(donaTtsModelChain(undefined)[0]).toBe("gpt-4o-mini-tts")
  })
})

describe("dona voice prompt", () => {
  it("asks for short spoken replies without urls", () => {
    expect(DONA_VOICE_MODE_PROMPT.toLowerCase()).toContain("vocale")
    expect(DONA_VOICE_MODE_PROMPT.toLowerCase()).toContain("url")
  })
})

describe("dona voice routes", () => {
  it("GET status reports enabled neural flags without throwing", async () => {
    const res = await getVoiceStatus()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { enabled: boolean; neuralStt: boolean; neuralTts: boolean }
    expect(body.enabled).toBe(true)
    expect(typeof body.neuralStt).toBe("boolean")
    expect(typeof body.neuralTts).toBe("boolean")
  })

  it("POST transcribe rejects missing audio", async () => {
    const res = await postTranscribe(
      new Request("http://localhost/api/dona/voice/transcribe", {
        method: "POST",
        body: new FormData(),
      })
    )
    expect([400, 503]).toContain(res.status)
  })

  it("POST speak rejects empty text when neural TTS is on, else 204", async () => {
    const res = await postSpeak(
      new Request("http://localhost/api/dona/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   ", locale: "fr" }),
      })
    )
    expect([400, 204, 503]).toContain(res.status)
  })
})
