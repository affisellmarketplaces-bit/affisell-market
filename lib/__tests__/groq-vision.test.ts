import { describe, expect, it } from "vitest"

import {
  capVisionImagesInMessages,
  countVisionImagesInMessages,
  GROQ_VISION_MAX_IMAGES,
} from "@/lib/ai/groq-vision"

describe("groq-vision", () => {
  it("caps image parts in messages", () => {
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "hi" },
          ...Array.from({ length: 6 }, (_, i) => ({
            type: "image_url" as const,
            image_url: { url: `https://example.com/${i}.jpg` },
          })),
        ],
      },
    ]
    expect(countVisionImagesInMessages(messages)).toBe(6)
    const capped = capVisionImagesInMessages(messages, GROQ_VISION_MAX_IMAGES)
    expect(countVisionImagesInMessages(capped)).toBe(4)
  })
})
