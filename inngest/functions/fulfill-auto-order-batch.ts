import { inngest } from "@/inngest/client"
import { runAutoFulfillmentBatch } from "@/lib/auto-order/engine"

export const fulfillAutoOrderBatch = inngest.createFunction(
  {
    id: "fulfill-auto-order-batch",
    name: "Auto-Order Engine · fulfill checkout batch",
    retries: 4,
    triggers: [{ event: "auto-order/batch.fulfill" }],
  },
  async ({ event, step }) => {
    const stripeSessionId =
      typeof event.data.stripeSessionId === "string" ? event.data.stripeSessionId : ""
    if (!stripeSessionId) throw new Error("missing_stripeSessionId")

    await step.run("run-auto-fulfillment", async () => {
      await runAutoFulfillmentBatch(stripeSessionId)
    })
  }
)
