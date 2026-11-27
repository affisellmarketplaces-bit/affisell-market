import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Every Stripe transfer created INTO AN ORDER'S transfer group must say which leg it pays (`metadata.role`).
 * The lost-call / other-rail search (findExistingTransfers) treats a role-less transfer to the same account as "this leg
 * is already paid" — fail-safe for history, but a NEW role-less writer would make a legitimate leg look paid. This scan
 * keeps that from happening silently.
 */
const ROOT = process.cwd()
function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") files(p, out)
    } else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

const calls = [...files(path.join(ROOT, "lib")), ...files(path.join(ROOT, "app"))].flatMap((file) => {
  const src = fs.readFileSync(file, "utf8")
  const out: Array<{ file: string; body: string }> = []
  let i = src.indexOf("transfers.create(")
  while (i >= 0) {
    out.push({ file: path.relative(ROOT, file), body: src.slice(i, i + 900) })
    i = src.indexOf("transfers.create(", i + 1)
  }
  return out
})

describe("transfer creators name the leg they pay", () => {
  it("the scan finds the known creators", () => {
    expect(calls.length).toBeGreaterThanOrEqual(5)
    expect(calls.some((c) => c.file === "lib/transfers/process-transfers.ts")).toBe(true)
  })

  it("every create that sets transfer_group also sets metadata.role", () => {
    const offenders = calls
      .filter((c) =>
        /transfer_group/.test(
          c.body.slice(0, c.body.indexOf("idempotencyKey") > 0 ? c.body.indexOf("idempotencyKey") : 900),
        ),
      )
      .filter(
        (c) =>
          !/\brole\b/.test(
            c.body.slice(0, c.body.indexOf("idempotencyKey") > 0 ? c.body.indexOf("idempotencyKey") : 900),
          ),
      )
      .map((c) => c.file)
    expect(offenders).toEqual([])
  })
})
