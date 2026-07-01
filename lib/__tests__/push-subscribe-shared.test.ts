import { describe, expect, it } from "vitest"

import { parsePushSubscribeJson } from "@/lib/push-subscribe-shared"

describe("parsePushSubscribeJson", () => {
  it("accepts valid subscription payload", () => {
    expect(
      parsePushSubscribeJson({
        endpoint: "https://push.example/abc",
        keys: { p256dh: "key", auth: "secret" },
      })
    ).toEqual({
      endpoint: "https://push.example/abc",
      keys: { p256dh: "key", auth: "secret" },
    })
  })

  it("rejects incomplete payload", () => {
    expect(parsePushSubscribeJson({ endpoint: "x" })).toBeNull()
    expect(parsePushSubscribeJson(null)).toBeNull()
  })
})
