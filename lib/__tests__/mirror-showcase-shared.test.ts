import { describe, expect, it } from "vitest"

import {
  isMirrorAttractRouteAllowed,
  mirrorProductPose,
  readMirrorAttractDelayMs,
} from "@/lib/mirror-showcase-shared"

describe("mirror-showcase-shared", () => {
  it("blocks dashboard and checkout routes", () => {
    expect(isMirrorAttractRouteAllowed("/dashboard/supplier")).toBe(false)
    expect(isMirrorAttractRouteAllowed("/checkout")).toBe(false)
    expect(isMirrorAttractRouteAllowed("/login")).toBe(false)
  })

  it("allows home and marketplace routes", () => {
    expect(isMirrorAttractRouteAllowed("/")).toBe(true)
    expect(isMirrorAttractRouteAllowed("/marketplace/abc")).toBe(true)
    expect(isMirrorAttractRouteAllowed("/discover")).toBe(true)
  })

  it("uses shorter delay in kiosk mode", () => {
    expect(readMirrorAttractDelayMs(true)).toBe(2_000)
    expect(readMirrorAttractDelayMs(false)).toBeGreaterThanOrEqual(5_000)
  })

  it("returns stable pose per index", () => {
    const a = mirrorProductPose(3, 12)
    const b = mirrorProductPose(3, 12)
    expect(a).toEqual(b)
    expect(a.xPct).toBeGreaterThan(0)
    expect(a.yPct).toBeGreaterThan(0)
  })
})
