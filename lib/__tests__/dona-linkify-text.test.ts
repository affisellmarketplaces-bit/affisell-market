import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DonaLinkifiedText } from "@/components/dona/dona-linkify-text"

function render(text: string): string {
  return renderToStaticMarkup(createElement(DonaLinkifiedText, { text }))
}

function hrefs(text: string): string[] {
  const html = render(text)
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!.replaceAll("&amp;", "&"))
}

describe("DonaLinkifiedText", () => {
  it("links a bold path mid-sentence without leaking the ** markers into the href", () => {
    const text = "Bonjour ! Inscris-toi directement ici : **/signup/affiliate** – c'est le point de départ 💜."
    const html = render(text)
    expect(hrefs(text)).toEqual(["/signup/affiliate"])
    expect(html).not.toContain("**")
  })

  it("links a path at the start of the line", () => {
    expect(hrefs("/signup/affiliate puis choisis tes produits")).toEqual(["/signup/affiliate"])
  })

  it("keeps trailing punctuation out of the href", () => {
    expect(hrefs("Va sur /signup/affiliate.")).toEqual(["/signup/affiliate"])
    expect(hrefs("(voir /discover)")).toEqual(["/discover"])
  })

  it("stops at separators and emoji instead of swallowing them", () => {
    expect(hrefs("Revendeur → /signup/affiliate · Pulse → /radar 💜")).toEqual([
      "/signup/affiliate",
      "/radar",
    ])
    expect(hrefs("/signup/affiliate💜")).toEqual(["/signup/affiliate"])
  })

  it("keeps query strings", () => {
    expect(hrefs("Lien : /signup/affiliate?plan=lanceur&interval=annual")).toEqual([
      "/signup/affiliate?plan=lanceur&interval=annual",
    ])
  })

  it("renders markdown links (internal and external) without double-linking the inner path", () => {
    expect(hrefs("[S'inscrire](/signup/affiliate) maintenant")).toEqual(["/signup/affiliate"])
    expect(hrefs("[Doc](https://stripe.com/docs)")).toEqual(["https://stripe.com/docs"])
    expect(hrefs("[Aide](https://affisell.com/help)")).toEqual(["/help"])
    expect(hrefs("[**S'inscrire**](/signup/affiliate)")).toEqual(["/signup/affiliate"])
  })

  it("turns an absolute link to our own site into an in-app path (works on previews / other hosts too)", () => {
    expect(hrefs("Ici : **https://affisell.com/signup/affiliate**.")).toEqual(["/signup/affiliate"])
    expect(hrefs("https://affisell.com/signup/affiliate")).toEqual(["/signup/affiliate"])
    expect(hrefs("[Inscription](https://www.affisell.com/signup/supplier?role=supplier)")).toEqual([
      "/signup/supplier?role=supplier",
    ])
    expect(hrefs("https://affisell-market.vercel.app/signup/supplier")).toEqual(["/signup/supplier"])
  })

  it("links our host written without a scheme — models often drop it", () => {
    expect(hrefs("Inscris-toi sur affisell.com/signup/supplier dès maintenant")).toEqual(["/signup/supplier"])
    expect(hrefs("www.affisell.com/signup/affiliate.")).toEqual(["/signup/affiliate"])
  })

  it("never links a bare domain mention or an e-mail address", () => {
    expect(hrefs("Écris à support@affisell.com ou visite affisell.com")).toEqual([])
  })

  it("keeps genuinely external links external (new tab, no opener)", () => {
    const html = render("Doc : https://stripe.com/docs/checkout")
    expect(hrefs("Doc : https://stripe.com/docs/checkout")).toEqual(["https://stripe.com/docs/checkout"])
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(render("Va sur /signup/affiliate")).not.toContain('target="_blank"')
  })

  it("links the supplier / reseller entry pages Dona may name", () => {
    expect(hrefs("Présentation : /sell/become-supplier puis /become-reseller")).toEqual([
      "/sell/become-supplier",
      "/become-reseller",
    ])
    expect(hrefs("Tarifs sur /pricing, aide sur /help.")).toEqual(["/pricing", "/help"])
    expect(hrefs("Inscription fournisseur : [Créer mon compte](/signup/supplier)")).toEqual(["/signup/supplier"])
  })

  it("does not link look-alike routes", () => {
    expect(hrefs("/signupx et /logins et /sellers")).toEqual([])
  })

  it("never emits a malformed percent-escape in an href", () => {
    expect(hrefs("/signup/affiliate%zz")).toEqual(["/signup/affiliate"])
  })

  it("leaves unrelated slashes alone", () => {
    expect(hrefs("Livraison et/ou retours 14j")).toEqual([])
  })
})
