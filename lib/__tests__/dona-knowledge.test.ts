import { describe, expect, it } from "vitest"

import { DONA_AFFISELL_KNOWLEDGE } from "@/lib/dona/knowledge-public"
import { DONA_PUBLIC_SYSTEM_PROMPT } from "@/lib/dona/prompt-public"

describe("dona knowledge", () => {
  it("states reseller margin model", () => {
    expect(DONA_AFFISELL_KNOWLEDGE).toMatch(/marge|markup/i)
    expect(DONA_AFFISELL_KNOWLEDGE).toContain("/signup/affiliate")
    expect(DONA_AFFISELL_KNOWLEDGE).toContain("Oui, c'est le cœur du modèle")
  })

  it("injects knowledge into public prompt", () => {
    expect(DONA_PUBLIC_SYSTEM_PROMPT).toContain("revendeur-first")
    expect(DONA_PUBLIC_SYSTEM_PROMPT).toContain("marge perso")
  })
})
