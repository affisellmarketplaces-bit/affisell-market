import { NextResponse } from "next/server"

import { createGroqClient, getGroqApiKey } from "@/lib/ai/groq-client"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export async function GET() {
  const admin = await requireAdminSession()
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const apiKey = getGroqApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY missing in .env.local", exists: false }, { status: 500 })
  }

  try {
    const groq = createGroqClient()
    if (!groq) {
      return NextResponse.json({ error: "GROQ_API_KEY missing", exists: false }, { status: 500 })
    }
    await groq.models.list()
    return NextResponse.json({
      success: true,
      message: "GROQ_API_KEY works",
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message, exists: true }, { status: 500 })
  }
}
