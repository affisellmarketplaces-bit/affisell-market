import { Inngest } from "inngest"

export const inngest = new Inngest({
  id: "affisell-market",
  name: "Affisell Market",
  eventKey: process.env.INNGEST_EVENT_KEY,
})
