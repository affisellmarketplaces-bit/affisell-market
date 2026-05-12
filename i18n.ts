import { getRequestConfig } from "next-intl/server"

const supported = new Set(["en", "fr"])

export default getRequestConfig(async () => {
  const raw = (process.env.NEXT_PUBLIC_MESSAGES_LOCALE ?? "en").toLowerCase()
  const locale = supported.has(raw) ? raw : "en"
  const messages =
    locale === "fr"
      ? (await import("./messages/fr.json")).default
      : (await import("./messages/en.json")).default

  return {
    locale,
    /** EU-first — align server date formatting with storefront (`lib/market-config`). */
    timeZone: "Europe/Paris",
    messages,
  }
})
