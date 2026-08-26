import { z } from "zod"

import { confirmSignature } from "@/lib/legal/signature"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const confirmSchema = z
  .object({
    token: z.string().min(1),
    signatureData: z.string().min(20),
    signerName: z.string().optional(),
  })
  .strict()

/** Public — confirme signature canvas / électronique. */
export async function POST(req: Request) {
  try {
    const body = confirmSchema.parse(await req.json())
    const result = await confirmSignature(body)

    if (!result.ok) {
      const status = result.error === "token_not_found" ? 404 : 400
      return Response.json({ ok: false, error: result.error }, { status })
    }

    return Response.json(result)
  } catch (error) {
    console.error("[legal:sign:confirm]", {
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }
}
