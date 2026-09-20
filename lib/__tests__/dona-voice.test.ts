import { describe, expect, it } from "vitest"

import {
  detectDonaSpeechSupport,
  donaSpeechLang,
  donaTextForSpeech,
  pickDonaTtsVoice,
} from "@/lib/dona/dona-voice-shared"
import { resolveDonaSpeakTarget } from "@/lib/dona/dona-speak-target"

describe("dona voice shared", () => {
  it("maps locales to BCP-47 speech tags", () => {
    expect(donaSpeechLang("fr")).toBe("fr-FR")
    expect(donaSpeechLang("en")).toBe("en-US")
    expect(donaSpeechLang("zh")).toBe("zh-CN")
  })

  it("strips markdown and caps length for natural TTS", () => {
    const spoken = donaTextForSpeech(
      "## Hello\nBuy **now** at [Affisell](https://affisell.com) — `code` 💜"
    )
    expect(spoken).toContain("Hello")
    expect(spoken).toContain("Buy now at Affisell")
    expect(spoken).not.toContain("**")
    expect(spoken).not.toContain("http")
    expect(spoken).not.toContain("💜")
  })

  it("picks a locale-matching TTS voice when available", () => {
    const picked = pickDonaTtsVoice(
      [
        { lang: "en-US", name: "Microsoft David" },
        { lang: "fr-FR", name: "Google français", localService: true },
        { lang: "de-DE", name: "Anna" },
      ],
      "fr"
    )
    expect(picked?.lang).toBe("fr-FR")
  })

  it("reports no speech support without a window", () => {
    expect(detectDonaSpeechSupport(undefined)).toEqual({ stt: false, tts: false })
  })
})

describe("resolveDonaSpeakTarget", () => {
  it("returns the latest assistant text message", () => {
    const target = resolveDonaSpeakTarget([
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Salut" }],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Bonjour Capitaine" }],
      },
      {
        id: "u2",
        role: "user",
        parts: [{ type: "text", text: "suite" }],
      },
    ])
    expect(target).toEqual({ id: "a1", text: "Bonjour Capitaine" })
  })

  it("skips empty assistant shells", () => {
    expect(
      resolveDonaSpeakTarget([
        { id: "a0", role: "assistant", parts: [{ type: "text", text: "   " }] },
      ])
    ).toBeNull()
  })
})
