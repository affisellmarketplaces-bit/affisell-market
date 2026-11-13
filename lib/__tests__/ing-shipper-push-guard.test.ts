import { beforeEach, describe, expect, it, vi } from "vitest"

// `npm run push:safe` pushes main (production). The AI engineer ("Ing") commits code a model wrote; the push must be an explicit
// opt-in (ING_ALLOW_PUSH=true), never the default. Everything is mocked: no git, no npm is ever run.

const calls: Array<{ cmd: string; args: string[] }> = []
vi.mock("node:child_process", () => ({
  spawnSync: (cmd: string, args: string[]) => {
    calls.push({ cmd, args })
    if (cmd === "git" && args[0] === "rev-parse") return { status: 0, stdout: "abc1234\n", stderr: "" }
    return { status: 0, stdout: "ok", stderr: "" }
  },
}))

import { IngShipper, isIngPushAllowed } from "@/lib/ai-engineer/shipper"

const actions = [{ file: "lib/example.ts" }] as never

const pushCalls = () => calls.filter((c) => c.cmd === "npm" && c.args.join(" ").includes("push:safe"))

beforeEach(() => {
  calls.length = 0
  vi.unstubAllEnvs()
})

describe("isIngPushAllowed", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["1", false],
    ["TRUE", false],
    ["yes", false],
    [" true", false],
    ["true", true],
  ])("ING_ALLOW_PUSH=%j -> %s", (value, expected) => {
    expect(isIngPushAllowed({ ING_ALLOW_PUSH: value })).toBe(expected)
  })
})

describe("IngShipper.ship", () => {
  it("commits locally but does NOT push by default", async () => {
    const result = await new IngShipper().ship(actions, { message: "fix(ing): t" })
    expect(calls.some((c) => c.cmd === "git" && c.args[0] === "commit")).toBe(true)
    expect(pushCalls()).toHaveLength(0)
    expect(result.commit).toBe("abc1234")
    expect(result.push).toBe(false)
  })

  it("does NOT push when the flag has any value other than the exact word true", async () => {
    vi.stubEnv("ING_ALLOW_PUSH", "1")
    await new IngShipper().ship(actions, { message: "fix(ing): t" })
    expect(pushCalls()).toHaveLength(0)
  })

  it("pushes only with ING_ALLOW_PUSH=true", async () => {
    vi.stubEnv("ING_ALLOW_PUSH", "true")
    const result = await new IngShipper().ship(actions, { message: "fix(ing): t" })
    expect(pushCalls()).toHaveLength(1)
    expect(result.push).toBe(true)
  })

  it("a dry run never runs git or npm at all", async () => {
    vi.stubEnv("ING_ALLOW_PUSH", "true")
    await new IngShipper().ship(actions, { dryRun: true })
    expect(calls).toHaveLength(0)
  })
})
