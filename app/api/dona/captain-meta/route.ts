import {
  DONA_CAPTAIN_FORBIDDEN,
  isDonaCaptainReferer,
} from "@/lib/dona/captain-access"
import { getEnvInfo } from "@/lib/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!isDonaCaptainReferer(req)) {
    return Response.json({ error: DONA_CAPTAIN_FORBIDDEN }, { status: 403 })
  }

  try {
    const info = getEnvInfo()
    return Response.json({
      env: info.env,
      branch: info.branch,
      dbHost: info.dbHost,
      isProd: info.isProd,
      label: info.isProd ? "PRODUCTION" : "STAGING",
    })
  } catch {
    return Response.json({
      env: "unknown",
      branch: "unknown",
      dbHost: "(unset)",
      isProd: false,
      label: "UNKNOWN",
    })
  }
}
