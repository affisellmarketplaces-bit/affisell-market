import { getRequestConfig } from "next-intl/server"

export default getRequestConfig(async () => ({
  locale: "en",
  /** EU-first — align server date formatting with storefront (`lib/market-config`). */
  timeZone: "Europe/Paris",
  messages: (await import("./messages/en.json")).default,
}))
