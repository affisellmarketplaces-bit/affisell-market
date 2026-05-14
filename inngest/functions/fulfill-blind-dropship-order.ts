import { inngest } from "@/inngest/client"
import { runBlindDropshipFulfillment } from "@/lib/blind-dropship-fulfill"

export const fulfillBlindDropshipOrder = inngest.createFunction(
  {
    id: "fulfill-blind-dropship-order",
    name: "Blind dropship · fulfill order",
    retries: 3,
    triggers: [{ event: "blind/order.fulfill" }],
  },
  async ({ event, step }) => {
    const orderId = typeof event.data.orderId === "string" ? event.data.orderId : ""
    if (!orderId) throw new Error("missing_orderId")
    await step.run("fulfill-partner-orders", async () => {
      await runBlindDropshipFulfillment(orderId)
    })
  }
)
