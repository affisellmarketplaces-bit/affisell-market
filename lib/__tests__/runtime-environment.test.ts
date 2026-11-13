import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { readVercelEnvironment, resolveRuntimeEnvironment, resolveSentryEnvironment } from "@/lib/runtime-environment"

describe("resolveRuntimeEnvironment", () => {
  it.each([
    [{ VERCEL_ENV: "production", NODE_ENV: "production" }, "production"],
    // the bug: NODE_ENV is "production" on a Preview too
    [{ VERCEL_ENV: "preview", NODE_ENV: "production" }, "preview"],
    [{ VERCEL_ENV: "development", NODE_ENV: "development" }, "development"],
    [{ VERCEL_ENV: " Preview ", NODE_ENV: "production" }, "preview"],
    // no Vercel signal → NODE_ENV (the self-hosted production worker is "production")
    [{ NODE_ENV: "production" }, "production"],
    [{ NODE_ENV: "development" }, "development"],
    [{ NODE_ENV: "test" }, "test"],
    [{}, "development"],
    // an unknown VERCEL_ENV value is not trusted
    [{ VERCEL_ENV: "staging", NODE_ENV: "development" }, "development"],
    // the browser bundle only sees NEXT_PUBLIC_VERCEL_ENV
    [{ NEXT_PUBLIC_VERCEL_ENV: "preview", NODE_ENV: "production" }, "preview"],
  ])("%j → %s", (env, expected) => {
    expect(resolveRuntimeEnvironment(env)).toBe(expected)
  })

  it("VERCEL_ENV wins over NEXT_PUBLIC_VERCEL_ENV", () => {
    expect(readVercelEnvironment({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "preview" })).toBe("production")
  })
})

describe("resolveSentryEnvironment — a Preview is never filed under production", () => {
  it.each([
    [{ VERCEL_ENV: "production", NODE_ENV: "production" }, "production"],
    [{ VERCEL_ENV: "preview", NODE_ENV: "production" }, "preview"],
    [{ NEXT_PUBLIC_VERCEL_ENV: "preview", NODE_ENV: "production" }, "preview"],
    [{ VERCEL_ENV: "development", NODE_ENV: "development" }, "development"],
    [{ NODE_ENV: "development" }, "development"],
    [{ NODE_ENV: "test" }, "test"],
    // no Vercel proof: a local `next start`, a CI build, a browser bundle without the signal → NOT production
    [{ NODE_ENV: "production" }, "unknown"],
    [{}, "development"],
  ])("%j → %s", (env, expected) => {
    expect(resolveSentryEnvironment(env)).toBe(expected)
  })

  it("the three Sentry configs use it instead of NODE_ENV (the Preview = Production bug)", () => {
    for (const file of ["sentry.server.config.ts", "sentry.edge.config.ts", "instrumentation-client.ts"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8")
      expect(source, file).toContain("resolveSentryEnvironment(")
      expect(source, file).not.toMatch(/environment:\s*process\.env\.NODE_ENV/)
    }
  })

  it("the browser bundle gets the Vercel environment inlined by next.config.ts, and the client config reads it as a LITERAL (Next inlines only those)", () => {
    expect(readFileSync(join(process.cwd(), "next.config.ts"), "utf8")).toContain("NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV")
    expect(readFileSync(join(process.cwd(), "instrumentation-client.ts"), "utf8")).toContain("process.env.NEXT_PUBLIC_VERCEL_ENV")
  })
})
