import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * `/login` is the PROFESSIONAL selector (creator / supplier). Buyer actions — saving a product, following a store —
 * must send visitors to the buyer sign-in (`/login/customer`, `/signup/customer`, or the store's own `/shops/:slug/login`).
 * This guards the Wish regression: a guest saving a product used to land on the professional accounts.
 */
const BUYER_ACTION_FILES = [
  "components/pulse/buyer-swipe-commerce.tsx",
  "components/pulse/affisell-pulse-experience.tsx",
  "components/store-social-bar.tsx",
]

// a string / template literal that starts with the professional selector route
const PRO_SELECTOR = /["'`]\/login(?:\?|["'`])/

/** Source without comments (the explanations mention `/login` on purpose). */
function code(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

describe("buyer actions never route to the professional login selector", () => {
  for (const file of BUYER_ACTION_FILES) {
    it(file, () => {
      expect(code(file)).not.toMatch(PRO_SELECTOR)
    })
  }

  it("the Wish flow uses the buyer routes and keeps the visitor in the feed", () => {
    const source = code("components/pulse/buyer-swipe-commerce.tsx")
    expect(source).toContain("signupCustomerPath")
    expect(source).toContain("loginCustomerPath")
    // the guest branch of saveDrop must not navigate on its own any more
    const guestBranch = source.slice(source.indexOf("if (!session.userId)"), source.indexOf("const pushPermission"))
    expect(guestBranch).not.toMatch(/navigate\(/)
  })
})
