import { donaVoiceCapabilities } from "@/lib/dona/voice-audio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(donaVoiceCapabilities(), {
    headers: { "Cache-Control": "no-store" },
  })
}
