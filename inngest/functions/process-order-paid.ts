import { inngest } from "@/inngest/client"
import { fulfillAffisellOrderWithAliExpress } from "@/lib/aliexpress-fulfill-order"
import { ORDER_PAID_EVENT } from "@/lib/fulfillment/order-paid-queue"

export const processOrderPaid = inngest.createFunction(
  {
    id: "process-order-paid-aliexpress",
    name: "Order paid · AliExpress DS fulfill",
    retries: 3,
    triggers: [{ event: ORDER_PAID_EVENT }],
  },
  async ({ event, step }) => {
    const orderId = typeof event.data.orderId === "string" ? event.data.orderId : ""
    if (!orderId) throw new Error("missing_orderId")

    const result = await step.run("fulfill-aliexpress", async () => {
      return fulfillAffisellOrderWithAliExpress(orderId)
    })

    if (!result.ok) {
      const retryable =
        result.error.includes("rate") ||
        result.error.includes("limit") ||
        result.error.includes("timeout")
      if (retryable) throw new Error(result.error)
      console.log("[inngest/order.paid]", { result: "non_retryable", orderId, error: result.error })
    }

    return result
  }
)
