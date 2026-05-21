import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { getBullBoardExpressApp } from "@/lib/auto-order/bullmq/bull-board-server"
import { runExpressOnNextRequest } from "@/lib/auto-order/bullmq/express-next-bridge"
import { isAutoOrderQueueEnabled } from "@/lib/auto-order/redis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handleBoard(req: NextRequest) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  if (!isAutoOrderQueueEnabled()) {
    return NextResponse.json(
      {
        error: "queue_unavailable",
        message: "Set REDIS_URL and run Redis (docker compose up -d redis) to enable Bull Board.",
      },
      { status: 503 }
    )
  }

  try {
    const app = getBullBoardExpressApp()
    return await runExpressOnNextRequest(app, req)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[bull-board]", msg)
    return NextResponse.json({ error: "bull_board_error", message: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleBoard(req)
}

export async function POST(req: NextRequest) {
  return handleBoard(req)
}

export async function PUT(req: NextRequest) {
  return handleBoard(req)
}

export async function PATCH(req: NextRequest) {
  return handleBoard(req)
}

export async function DELETE(req: NextRequest) {
  return handleBoard(req)
}
