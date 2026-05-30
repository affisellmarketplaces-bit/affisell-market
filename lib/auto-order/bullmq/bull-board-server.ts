import { createBullBoard } from "@bull-board/api"
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { ExpressAdapter } from "@bull-board/express"
import express from "express"

import {
  getBatchFulfillQueue,
  getPlaceSupplierOrderDlq,
  getPlaceSupplierOrderQueue,
} from "@/lib/auto-order/bullmq/place-order.queue"
import { getAutoBuyQueue } from "@/lib/fulfillment/bullmq/auto-buy.queue"
import { isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"

export const BULL_BOARD_BASE_PATH = "/admin/queues/board"

let boardApp: express.Application | null = null

function buildBoardApp(): express.Application {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath(BULL_BOARD_BASE_PATH)

  createBullBoard({
    queues: [
      new BullMQAdapter(getPlaceSupplierOrderQueue(), {
        readOnlyMode: false,
        description: "Supplier place-order jobs (retry / promote from UI)",
      }),
      new BullMQAdapter(getPlaceSupplierOrderDlq(), {
        readOnlyMode: false,
        description: "Dead-letter queue after max retries",
      }),
      new BullMQAdapter(getBatchFulfillQueue(), {
        readOnlyMode: false,
        description: "Checkout batch fulfillment",
      }),
      new BullMQAdapter(getAutoBuyQueue(), {
        readOnlyMode: false,
        description: "AliExpress auto-buy (FulfillmentLog)",
      }),
    ],
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: "Affisell Fulfillment",
        boardLogo: { path: "/favicon.ico", width: 32, height: 32 },
        miscLinks: [
          { text: "Auto-Fulfill", url: "/admin/auto-fulfill" },
          { text: "Admin reviews", url: "/admin/reviews" },
          { text: "Auto-order retry API", url: "/api/auto-order/retry" },
        ],
      },
    },
  })

  const app = express()
  app.use(BULL_BOARD_BASE_PATH, serverAdapter.getRouter())
  return app
}

export function getBullBoardExpressApp(): express.Application {
  if (!isAutoOrderQueueEnabled()) {
    throw new Error("REDIS_URL is required for Bull Board (auto-order queues)")
  }
  if (!boardApp) {
    boardApp = buildBoardApp()
  }
  return boardApp
}
