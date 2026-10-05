import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"

import { donaPublicAudiencePromptBlock } from "@/lib/dona/dona-audience"
import { DONA_LOGIN_PATH, DONA_SIGNUP_PATH } from "@/lib/dona/dona-links"
import { donaPublicOfflineReply } from "@/lib/dona/dona-static-fallback"
import { DONA_AFFISELL_KNOWLEDGE } from "@/lib/dona/knowledge-public"
import { DONA_PUBLIC_SYSTEM_PROMPT } from "@/lib/dona/prompt-public"

const ask = (text: string): UIMessage[] => [{ id: "1", role: "user", parts: [{ type: "text", text }] } as UIMessage]

describe("Dona sends each role to ACCOUNT CREATION", () => {
  it("the prompt names the sign-up page per role and keeps login for people who already have an account", () => {
    expect(DONA_PUBLIC_SYSTEM_PROMPT).toContain(DONA_SIGNUP_PATH.supplier)
    expect(DONA_PUBLIC_SYSTEM_PROMPT).toContain(DONA_SIGNUP_PATH.reseller)
    expect(DONA_PUBLIC_SYSTEM_PROMPT).toMatch(/jamais la page de connexion/i)
    expect(DONA_PUBLIC_SYSTEM_PROMPT).toContain("[Créer mon compte fournisseur](/signup/supplier)")
  })

  it("the knowledge base no longer calls the supplier LOGIN page 'inscription'", () => {
    expect(DONA_AFFISELL_KNOWLEDGE).not.toMatch(/Inscription\s*:\s*\/login\/supplier/)
    expect(DONA_AFFISELL_KNOWLEDGE).toContain(`Inscription fournisseur : ${DONA_SIGNUP_PATH.supplier}`)
    expect(DONA_AFFISELL_KNOWLEDGE).toContain(DONA_SIGNUP_PATH.reseller)
  })

  it("the supplier-page prompt block points at sign-up", () => {
    const block = donaPublicAudiencePromptBlock("supplier")
    expect(block).toContain(DONA_SIGNUP_PATH.supplier)
    expect(donaPublicAudiencePromptBlock("reseller")).toContain(DONA_SIGNUP_PATH.reseller)
  })

  it("the offline fallback answers a supplier with the supplier sign-up (it used to answer with reseller advice)", () => {
    for (const q of ["Comment m'inscrire comme fournisseur ?", "I want to sign up as a supplier", "devenir grossiste"]) {
      const reply = donaPublicOfflineReply(ask(q))
      expect(reply, q).toContain(DONA_SIGNUP_PATH.supplier)
      expect(reply, q).not.toContain(`→ ${DONA_SIGNUP_PATH.reseller}`)
    }
    expect(donaPublicOfflineReply(ask("Comment m'inscrire comme fournisseur ?"))).toContain(DONA_LOGIN_PATH.supplier)
  })

  it("the offline fallback still answers a reseller with the reseller sign-up, pointing suppliers to theirs", () => {
    const reply = donaPublicOfflineReply(ask("Comment devenir revendeur ?"))
    expect(reply).toContain(DONA_SIGNUP_PATH.reseller)
    expect(reply).toContain(DONA_SIGNUP_PATH.supplier)
    expect(reply).not.toMatch(/\(\/login\/supplier\)/)
  })
})
