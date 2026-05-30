import { inngest } from "@/inngest/client"
import { processAutoBuyFulfillmentLog } from "@/lib/fulfillment/auto-buy"

export const processAutoBuy = inngest.createFunction(
  {
    id: "process-auto-buy",
    name: "Auto-Buy · AliExpress fulfillment",
    retries: 3,
    triggers: [{ event: "auto-buy/process" }],
  },
  async ({ event, step }) => {
    const fulfillmentLogId =
      typeof event.data.fulfillmentLogId === "string" ? event.data.fulfillmentLogId : ""
    if (!fulfillmentLogId) throw new Error("missing_fulfillmentLogId")

    await step.run("run-auto-buy", async () => {
      await processAutoBuyFulfillmentLog(fulfillmentLogId)
    })
  }
)
