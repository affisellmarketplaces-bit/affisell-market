import { afterEach, describe, expect, it } from "vitest"

import { augmentPrismaDatasourceUrl } from "@/lib/prisma-datasource-url"

describe("augmentPrismaDatasourceUrl", () => {
  const prevEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = prevEnv
    delete process.env.PRISMA_CONNECTION_LIMIT
  })

  it("adds pool params for Neon pooler host", () => {
    process.env.NODE_ENV = "development"
    const raw =
      "postgresql://user:pass@ep-foo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("pgbouncer")).toBe("true")
    expect(url.searchParams.get("connection_limit")).toBe("20")
    expect(url.searchParams.get("pool_timeout")).toBe("60")
    expect(url.searchParams.get("connect_timeout")).toBe("15")
  })

  it("bumps low dev connection_limit on pooler URLs", () => {
    process.env.NODE_ENV = "development"
    const raw =
      "postgresql://user:pass@ep-foo-pooler.us-east-2.aws.neon.tech/neondb?connection_limit=5&pool_timeout=10"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("connection_limit")).toBe("20")
    expect(url.searchParams.get("pool_timeout")).toBe("10")
  })

  it("adds pool params for local Postgres in development", () => {
    process.env.NODE_ENV = "development"
    const raw = "postgresql://user:pass@localhost:5432/mydb"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("connection_limit")).toBe("20")
    expect(url.searchParams.get("pool_timeout")).toBe("60")
  })

  it("leaves non-pooler URLs unchanged in production", () => {
    process.env.NODE_ENV = "production"
    const raw = "postgresql://user:pass@localhost:5432/mydb"
    expect(augmentPrismaDatasourceUrl(raw)).toBe(raw)
  })
})
