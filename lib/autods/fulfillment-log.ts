import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type AutoDsLogSource = "webhook" | "cron" | "admin_resync"

export async function logAutoDsFulfillmentEvent(args: {
  orderId: string
  event: string
  response?: unknown
  source: AutoDsLogSource
}): Promise<void> {
  const payload: Prisma.InputJsonValue | undefined =
    args.response === undefined
      ? undefined
      : (JSON.parse(JSON.stringify(args.response)) as Prisma.InputJsonValue)

  await prisma.autodsFulfillmentLog.create({
    data: {
      orderId: args.orderId,
      provider: "autods",
      event: `${args.source}:${args.event}`,
      response: payload,
    },
  })

  console.log("[autods-fulfillment-log]", {
    orderId: args.orderId,
    provider: "autods",
    event: args.event,
    source: args.source,
  })
}
