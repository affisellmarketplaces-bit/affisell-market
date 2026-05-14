import { serve } from "inngest/next"

import { inngest } from "@/inngest/client"
import { fulfillBlindDropshipOrder } from "@/inngest/functions/fulfill-blind-dropship-order"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [fulfillBlindDropshipOrder],
})
