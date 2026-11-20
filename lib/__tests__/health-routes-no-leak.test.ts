import { beforeEach, describe, expect, it, vi } from "vitest"

// Finalisation master doc, C4: the public health routes leaked migration names and raw database error messages.

const queryRaw = vi.fn()
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) } }))

import { GET as healthDb } from "@/app/api/health/db/route"
import { GET as healthMigrations } from "@/app/api/health/migrations/route"

const SECRET_TEXT = "connection to server at db-host-abc.internal failed: password authentication failed for user app_user"

describe("public health routes do not leak internals", () => {
  beforeEach(() => {
    queryRaw.mockReset()
  })

  it("/api/health/db returns only a count, never migration names", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]).mockResolvedValueOnce([{ pending: BigInt(2) }])
    const json = await (await healthDb()).json()
    expect(json).toEqual({ ok: true, pendingMigrationsCount: 2 })
    expect(JSON.stringify(json)).not.toMatch(/migration_name|migrationName|\d{14}_/)
  })

  it("/api/health/db hides the raw database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    queryRaw.mockImplementation(async () => {
      throw new Error(SECRET_TEXT)
    })
    const res = await healthDb()
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).toBe(JSON.stringify({ ok: false }))
    expect(text).not.toContain("password")
    expect(text).not.toContain("db-host")
  })

  it("/api/health/migrations hides the raw database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    queryRaw.mockImplementation(async () => {
      throw new Error(SECRET_TEXT)
    })
    const res = await healthMigrations()
    expect(res.status).toBe(503)
    const text = await res.text()
    expect(text).not.toContain("password")
    expect(text).not.toContain("db-host")
    expect(JSON.parse(text)).not.toHaveProperty("error")
  })
})
