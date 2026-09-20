import { describe, expect, it } from "vitest"

import { DONA_VOICE_MODE_PROMPT } from "@/lib/dona/voice-prompt"
import {
  DONA_VOICE_MAX_AUDIO_BYTES,
  isAllowedDonaAudioMime,
  isDonaVoiceKillSwitched,
  whisperLanguageFromLocale,
} from "@/lib/dona/voice-limits"
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

describe("dona voice prompt", () => {
  it("asks for short spoken replies without urls", () => {
    expect(DONA_VOICE_MODE_PROMPT.toLowerCase()).toContain("vocale")
    expect(DONA_VOICE_MODE_PROMPT.toLowerCase()).toContain("url")
  })
})
