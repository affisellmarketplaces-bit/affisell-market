import { describe, expect, it } from "vitest"

import { detectDonaSignupIntent, findDonaSignupCtaPlacement } from "@/lib/dona/dona-signup-intent"

describe("detectDonaSignupIntent", () => {
  it("supplier sign-up requests, in French and English", () => {
    for (const q of [
      "Aide-moi à m'inscrire en tant que fournisseur",
      "Comment devenir supplier sur Affisell ?",
      "Je veux créer un compte fournisseur",
      "How do I sign up as a supplier?",
      "I want to become a wholesaler on Affisell",
    ]) {
      expect(detectDonaSignupIntent(q), q).toBe("supplier")
    }
  })

  it("reseller / affiliate sign-up requests", () => {
    for (const q of [
      "Aide-moi à m'inscrire en tant que revendeur",
      "Comment devenir affilié ?",
      "I want to register as a reseller",
      "How can I join as an affiliate?",
      "Je souhaite créer mon compte créateur",
    ]) {
      expect(detectDonaSignupIntent(q), q).toBe("reseller")
    }
  })

  it("other UI languages", () => {
    expect(detectDonaSignupIntent("Wie kann ich mich als Lieferant anmelden?")).toBe("supplier")
    expect(detectDonaSignupIntent("Quiero registrarme como proveedor")).toBe("supplier")
    expect(detectDonaSignupIntent("Voglio diventare rivenditore")).toBe("reseller")
    expect(detectDonaSignupIntent("Hoe word ik wederverkoper?")).toBe("reseller")
    expect(detectDonaSignupIntent("Chcę zarejestrować się jako dostawca")).toBe("supplier")
    expect(detectDonaSignupIntent("我想注册成为供应商")).toBe("supplier")
  })

  it("accents and case do not matter", () => {
    expect(detectDonaSignupIntent("COMMENT DEVENIR FOURNISSEUR")).toBe("supplier")
    expect(detectDonaSignupIntent("créateur : comment m’inscrire ?")).toBe("reseller")
  })

  it("a generic or two-role request offers every door", () => {
    expect(detectDonaSignupIntent("Je veux m'inscrire sur Affisell")).toBe("any")
    expect(detectDonaSignupIntent("how do I create an account?")).toBe("any")
    expect(detectDonaSignupIntent("Je veux devenir fournisseur ou revendeur, que choisir ?")).toBe("any")
  })

  it("does not fire on ordinary questions", () => {
    for (const q of [
      "Quel est le délai de livraison ?",
      "Quels sont les frais pour les fournisseurs ?",
      "Comment fonctionne la marge revendeur ?",
      "Je veux vendre mes produits",
      "Where is my order?",
      "",
      "  ",
      "ok",
    ]) {
      expect(detectDonaSignupIntent(q), q).toBeNull()
    }
    expect(detectDonaSignupIntent(null)).toBeNull()
    expect(detectDonaSignupIntent(undefined)).toBeNull()
  })

  it("ignores very long messages (pasted documents)", () => {
    expect(detectDonaSignupIntent("devenir fournisseur " + "x".repeat(700))).toBeNull()
  })
})

describe("findDonaSignupCtaPlacement", () => {
  const u = (text: string) => ({ role: "user", text })
  const a = (text: string) => ({ role: "assistant", text })

  it("goes under the answer to the latest sign-up request", () => {
    expect(findDonaSignupCtaPlacement([u("Bonjour"), a("Salut"), u("Je veux devenir fournisseur"), a("Voici")])).toEqual({
      intent: "supplier",
      afterIndex: 3,
    })
  })

  it("stays attached to that exchange when the visitor asks something else afterwards", () => {
    expect(
      findDonaSignupCtaPlacement([u("devenir fournisseur"), a("Voici"), u("et les frais ?"), a("Rien")])
    ).toEqual({ intent: "supplier", afterIndex: 1 })
  })

  it("with no reply yet (or a failed one) it goes at the end", () => {
    expect(findDonaSignupCtaPlacement([u("Je veux devenir revendeur")])).toEqual({ intent: "reseller", afterIndex: null })
  })

  it("the most recent request wins", () => {
    expect(
      findDonaSignupCtaPlacement([u("devenir fournisseur"), a("ok"), u("finalement devenir revendeur"), a("ok")])
    ).toEqual({ intent: "reseller", afterIndex: 3 })
  })

  it("null when nobody asked", () => {
    expect(findDonaSignupCtaPlacement([u("hello"), a("hi")])).toBeNull()
    expect(findDonaSignupCtaPlacement([])).toBeNull()
  })
})
