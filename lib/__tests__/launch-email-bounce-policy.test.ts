import { describe, expect, it } from "vitest"

import { resolveLaunchBounceAction } from "@/lib/expansion/launch-email-bounce-policy"

describe("resolveLaunchBounceAction", () => {
  it("requeues on first hard bounce", () => {
    expect(
      resolveLaunchBounceAction({
        launchNotifiedAt: new Date(),
        launchEmailBouncedAt: null,
        launchEmailSuppressedAt: null,
      })
    ).toBe("requeue")
  })

  it("suppresses after retry bounce", () => {
    expect(
      resolveLaunchBounceAction({
        launchNotifiedAt: new Date(),
        launchEmailBouncedAt: new Date(),
        launchEmailSuppressedAt: null,
      })
    ).toBe("suppress")
  })

  it("ignores already suppressed rows", () => {
    expect(
      resolveLaunchBounceAction({
        launchNotifiedAt: new Date(),
        launchEmailBouncedAt: new Date(),
        launchEmailSuppressedAt: new Date(),
      })
    ).toBe("ignore")
  })
})
