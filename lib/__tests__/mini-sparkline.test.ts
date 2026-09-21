import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { MiniSparkline } from "@/components/supplier/mission-control/mini-sparkline"

const render = (values: number[]) => renderToStaticMarkup(createElement(MiniSparkline, { id: "t", values }))

describe("MiniSparkline", () => {
  it("draws a flat dashed baseline when there is no revenue yet", () => {
    const html = render([0, 0, 0, 0])
    expect(html).toContain("stroke-dasharray")
    expect(html).not.toContain("<path")
  })

  it("draws the area + line + last-point marker for real data, with NaN-free coordinates", () => {
    const html = render([0, 0, 1200, 0, 300])
    expect(html).toContain("<path")
    expect(html).toContain("<circle")
    expect(html).not.toContain("NaN")
    expect(html).toContain("spark-t")
  })

  it("handles a single point without crashing", () => {
    expect(() => render([5])).not.toThrow()
  })
})
