import { createElement as h } from "react"
import { renderToString } from "react-dom/server"
import { useTranslations, type AbstractIntlMessages } from "next-intl"
import { describe, expect, it } from "vitest"

import { IntlAppProvider } from "@/components/providers/intl-app-provider"
import { IntlMessagesExtension } from "@/components/providers/intl-messages-extension"
import { PRIVATE_SURFACE_NAMESPACES, omitNamespaces, pickNamespaces } from "@/lib/i18n-client-scope"
import { loadAppMessages } from "@/lib/i18n-load-messages"

/**
 * Real next-intl rendering: the root sends the public subset, a dashboard layout extends it. A dashboard component
 * reading a private namespace must get the real string — the raw key is what a missing namespace would print.
 */
const fr = loadAppMessages("fr") as AbstractIntlMessages & { supplier: Record<string, unknown>; home: Record<string, unknown> }
const privateNs = PRIVATE_SURFACE_NAMESPACES[0]!
const privateKey = Object.entries(fr[privateNs] as Record<string, unknown>).find(([, v]) => typeof v === "string")![0]
const publicKey = Object.entries(fr.home).find(([, v]) => typeof v === "string")![0]

function Probe({ ns, k }: { ns: string; k: string }) {
  const t = useTranslations(ns)
  return h("span", null, t(k))
}

const now = new Date("2026-11-26T00:00:00Z")
const root = (children: React.ReactNode) =>
  h(IntlAppProvider, { locale: "fr", messages: omitNamespaces(fr, PRIVATE_SURFACE_NAMESPACES), now, children })

describe("IntlScope extension (real next-intl)", () => {
  it("a private namespace is NOT available under the root alone (proves the subset is applied)", () => {
    const html = renderToString(root(h(Probe, { ns: privateNs, k: privateKey })))
    expect(html).toContain(`${privateNs}.${privateKey}`)
  })

  it("under the extension the private namespace renders its real text, and public ones still work", () => {
    const extra = pickNamespaces(fr, PRIVATE_SURFACE_NAMESPACES)
    const html = renderToString(
      root(h(IntlMessagesExtension, { extra, children: [h(Probe, { key: "a", ns: privateNs, k: privateKey }), h(Probe, { key: "b", ns: "home", k: publicKey })] }))
    )
    expect(html).toContain(String((fr[privateNs] as Record<string, string>)[privateKey]).slice(0, 12))
    expect(html).not.toContain(`${privateNs}.${privateKey}`)
    expect(html).toContain(String(fr.home[publicKey]).slice(0, 12))
  })
})
