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
    expect(hrefs("[Aide](https://affisell.com/help)")).toEqual(["https://affisell.com/help"])
    expect(hrefs("[**S'inscrire**](/signup/affiliate)")).toEqual(["/signup/affiliate"])
  })

  it("links absolute URLs and strips markdown bold around them", () => {
    expect(hrefs("Ici : **https://affisell.com/signup/affiliate**.")).toEqual([
      "https://affisell.com/signup/affiliate",
    ])
  })

  it("does not re-link the path inside an absolute URL", () => {
    expect(hrefs("https://affisell.com/signup/affiliate")).toEqual([
      "https://affisell.com/signup/affiliate",
    ])
  })

  it("never emits a malformed percent-escape in an href", () => {
    expect(hrefs("/signup/affiliate%zz")).toEqual(["/signup/affiliate"])
  })

  it("leaves unrelated slashes alone", () => {
    expect(hrefs("Livraison et/ou retours 14j")).toEqual([])
  })
})
