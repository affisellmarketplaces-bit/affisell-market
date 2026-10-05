import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SafeImage } from "@/components/ui/safe-image"

const html = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(SafeImage, { alt: "x", width: 100, height: 100, ...props } as never))

describe("SafeImage", () => {
  it("does not throw for a host that is not configured, and loads it directly", () => {
    const out = html({ src: "https://brand-new-cdn.example/img/a.jpg" })
    expect(out).toContain('src="https://brand-new-cdn.example/img/a.jpg"')
    expect(out).not.toContain("/_next/image")
  })

  it("still optimizes configured hosts (unchanged behaviour)", () => {
    const out = html({ src: "https://ae01.alicdn.com/kf/a.jpg" })
    expect(out).toContain("/_next/image?url=https%3A%2F%2Fae01.alicdn.com%2Fkf%2Fa.jpg")
  })

  it("still optimizes local paths", () => {
    expect(html({ src: "/logo.png" })).toContain("/_next/image?url=%2Flogo.png")
  })

  it("makes protocol-relative marketplace URLs absolute instead of throwing", () => {
    const out = html({ src: "//unknown-cdn.example/a.jpg" })
    expect(out).toContain('src="https://unknown-cdn.example/a.jpg"')
  })

  it("does not throw on a malformed src either", () => {
    expect(() => html({ src: "ae01.alicdn.com/kf/a.jpg" })).not.toThrow()
  })

  it("keeps an explicit unoptimized flag", () => {
    const out = html({ src: "https://ae01.alicdn.com/kf/a.jpg", unoptimized: true })
    expect(out).toContain('src="https://ae01.alicdn.com/kf/a.jpg"')
  })
})
