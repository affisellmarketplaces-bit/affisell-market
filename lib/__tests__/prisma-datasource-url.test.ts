import { describe, expect, it } from "vitest"

import { augmentPrismaDatasourceUrl } from "@/lib/prisma-datasource-url"

describe("augmentPrismaDatasourceUrl", () => {
  it("adds pool params for Neon pooler host", () => {
    const raw =
      "postgresql://user:pass@ep-foo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("pgbouncer")).toBe("true")
    expect(url.searchParams.get("connection_limit")).toBe("15")
    expect(url.searchParams.get("pool_timeout")).toBe("30")
    expect(url.searchParams.get("connect_timeout")).toBe("15")
  })

  it("does not override explicit query params", () => {
    const raw =
      "postgresql://user:pass@ep-foo-pooler.us-east-2.aws.neon.tech/neondb?connection_limit=3&pool_timeout=10"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("connection_limit")).toBe("3")
    expect(url.searchParams.get("pool_timeout")).toBe("10")
  })

  it("leaves non-pooler URLs unchanged", () => {
    const raw = "postgresql://user:pass@localhost:5432/mydb"
    expect(augmentPrismaDatasourceUrl(raw)).toBe(raw)
  })
})
