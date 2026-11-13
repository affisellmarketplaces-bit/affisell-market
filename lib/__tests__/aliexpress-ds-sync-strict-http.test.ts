/**
 * `callAliExpressSyncMethod` — what it now tells the place-order code (fetch is mocked, nothing real is contacted).
 */
import { afterEach, describe, expect, it, vi } from "vitest"

import { callAliExpressSyncMethod } from "@/lib/aliexpress-ds-sync"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"

const base = {
  method: "aliexpress.ds.order.create",
  bizParams: { a: "b" },
  appKey: "k",
  appSecret: "s",
  accessToken: "t",
  host: "https://api.example.test/sync",
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) }))
  )
}

afterEach(() => vi.unstubAllGlobals())

describe("callAliExpressSyncMethod — strictHttpStatus", () => {
  it("a 503 with a JSON body that is not an error envelope: thrown with code HTTP_503 when strict", async () => {
    mockFetch(503, { something: "else" })
    const err = await callAliExpressSyncMethod({ ...base, strictHttpStatus: true }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AliExpressApiError)
    expect((err as AliExpressApiError).code).toBe("HTTP_503")
    expect((err as AliExpressApiError).message).toContain("503")
  })

  it("the same answer is returned as a payload when NOT strict (read-only callers keep their behaviour)", async () => {
    mockFetch(503, { something: "else" })
    await expect(callAliExpressSyncMethod(base)).resolves.toEqual({ something: "else" })
  })

  it("a 200 is returned as a payload even when strict", async () => {
    mockFetch(200, { ok: true })
    await expect(callAliExpressSyncMethod({ ...base, strictHttpStatus: true })).resolves.toEqual({ ok: true })
  })

  it("a gateway error keeps its CODE (the text alone used to be all that survived)", async () => {
    mockFetch(200, { error_response: { msg: "Remote service error", sub_msg: "remote connection timeout", sub_code: "isp.remote-service-timeout" } })
    const err = await callAliExpressSyncMethod({ ...base, strictHttpStatus: true }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AliExpressApiError)
    expect((err as AliExpressApiError).message).toBe("remote connection timeout")
    expect((err as AliExpressApiError).code).toBe("isp.remote-service-timeout")
  })

  it("keeps the gateway envelope TYPE (ISP = platform fault) and EVERY text field of the answer", async () => {
    mockFetch(200, { type: "ISP", message: "Remote service error", msg: "upstream said no", sub_msg: "price check failed", code: "15" })
    const err = (await callAliExpressSyncMethod(base).catch((e: unknown) => e)) as AliExpressApiError
    expect(err.gatewayType).toBe("ISP")
    expect(err.detail).toContain("price check failed")
    expect(err.detail).toContain("upstream said no")
    expect(err.detail).toContain("Remote service error")
  })

  it("an error_response whose sub_code starts with isp. / isv. is typed from it", async () => {
    mockFetch(200, { error_response: { msg: "Remote service error", sub_code: "isp.remote-service-timeout" } })
    expect(((await callAliExpressSyncMethod(base).catch((e: unknown) => e)) as AliExpressApiError).gatewayType).toBe("ISP")
    mockFetch(200, { error_response: { msg: "Invalid", sub_code: "isv.invalid-parameter" } })
    expect(((await callAliExpressSyncMethod(base).catch((e: unknown) => e)) as AliExpressApiError).gatewayType).toBe("ISV")
    mockFetch(200, { error_response: { msg: "no code at all" } })
    expect(((await callAliExpressSyncMethod(base).catch((e: unknown) => e)) as AliExpressApiError).gatewayType).toBeUndefined()
  })

  it("an ISP root answer keeps its code too", async () => {
    mockFetch(200, { type: "ISP", message: "Remote service error", code: "15" })
    const err = await callAliExpressSyncMethod(base).catch((e: unknown) => e)
    expect((err as AliExpressApiError).message).toBe("Remote service error")
    expect((err as AliExpressApiError).code).toBe("15")
  })
})
