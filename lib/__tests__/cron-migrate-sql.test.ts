import { describe, expect, it } from "vitest"

import { splitPostgresMigrationSql } from "@/lib/cron/migrate-sql"

describe("splitPostgresMigrationSql", () => {
  it("splits simple ALTER statements", () => {
    const sql = `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierSource" TEXT;`
    expect(splitPostgresMigrationSql(sql)).toHaveLength(2)
  })

  it("keeps DO $$ blocks as one statement", () => {
    const sql = `CREATE TABLE IF NOT EXISTS "Foo" (id TEXT PRIMARY KEY);

DO $$ BEGIN
  ALTER TABLE "Foo" ADD CONSTRAINT "Foo_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`
    const parts = splitPostgresMigrationSql(sql)
    expect(parts).toHaveLength(2)
    expect(parts[1]).toContain("DO $$")
    expect(parts[1]).toContain("END $$")
  })
})
