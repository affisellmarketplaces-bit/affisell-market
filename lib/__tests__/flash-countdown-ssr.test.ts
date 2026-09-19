import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }))
vi.mock("@/components/navigation/fast-link", () => ({ FastLink: () => null }))
vi.mock("@/components/ui/scroll-fade-row", () => ({ ScrollFadeRow: () => null }))

import { FlashCountdown } from "@/components/home/discovery/home-discovery-section"

describe("FlashCountdown is hydration-safe", () => {
  afterEach(() => vi.useRealTimers())

  it("server-renders the same fixed placeholder no matter what time it is", () => {
    vi.useFakeTimers()
    const endsAt = new Date(Date.UTC(2026, 8, 19, 12, 0, 0)).toISOString()
    const render = () => renderToString(createElement(FlashCountdown, { endsAt, onEnd: () => {} }))
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 19, 11, 56, 0)))
    const a = render()
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 19, 11, 56, 2)))
    const b = render()
    expect(a).toBe(b)
    expect(a).toContain("--:--")
  })
})
