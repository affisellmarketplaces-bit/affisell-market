import { getRequestConfig } from "next-intl/server"

export default getRequestConfig(async () => ({
  locale: "en",
  timeZone: "Europe/Paris",
  messages: (await import("./messages/en.json")).default,
}))
