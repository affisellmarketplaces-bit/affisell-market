import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import path from "node:path"

import { agreementPath, parseArgs } from "@/lib/legal/legal-publish-shared"

describe("legal:publish", () => {
  it("parses slug and version from argv", () => {
    const args = parseArgs(["customer", "1.0.0", "--changelog", "Initial CGU"])
    expect(args.slug).toBe("customer")
    expect(args.version).toBe("1.0.0")
    expect(args.changelog).toBe("Initial CGU")
    expect(args.locales).toEqual(["fr"])
    expect(args.dryRun).toBe(false)
  })

  it("rejects invalid semver", () => {
    expect(() => parseArgs(["customer", "v1"])).toThrow(/Invalid semver/)
  })

  it("resolves canonical FR agreement path", () => {
    const resolved = agreementPath("customer", "fr")
    expect(resolved).toBeTruthy()
    expect(existsSync(resolved!)).toBe(true)
    expect(resolved).toBe(
      path.join(process.cwd(), "legal", "agreements", "customer.md")
    )
  })
})
