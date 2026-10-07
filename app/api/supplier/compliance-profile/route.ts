import { auth } from "@/auth"
import { parseComplianceProfile } from "@/lib/listing-compliance/profile-shared"
import {
  ComplianceProfileUnavailableError,
  getComplianceProfile,
  saveComplianceProfile,
} from "@/lib/listing-compliance/profile.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Who = { ok: true; userId: string } | { ok: false; response: Response }

async function requireSupplier(): Promise<Who> {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, response: Response.json({ error: "Not authenticated" }, { status: 401 }) }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true, userId: session.user.id }
}

export async function GET() {
  const who = await requireSupplier()
  if (!who.ok) return who.response
  return Response.json(await getComplianceProfile(who.userId))
}

export async function PUT(req: Request) {
  const who = await requireSupplier()
  if (!who.ok) return who.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = parseComplianceProfile(body)
  if (!parsed.ok) return Response.json({ error: "validation_error", errors: parsed.errors }, { status: 400 })

  try {
    return Response.json({ profile: await saveComplianceProfile(who.userId, parsed.value), available: true })
  } catch (e) {
    if (e instanceof ComplianceProfileUnavailableError) {
      return Response.json({ error: "compliance_profile_unavailable" }, { status: 503 })
    }
    console.error("[compliance-profile] save failed", e instanceof Error ? e.message : e)
    return Response.json({ error: "save_failed" }, { status: 500 })
  }
}
