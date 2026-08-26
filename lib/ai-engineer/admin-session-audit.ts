import { readFileSync } from "node:fs"
import { join } from "node:path"

const AUTH_ACTIONS_FILE = "components/admin/admin-auth-actions.tsx"
const ADMIN_LAYOUT_FILES = ["app/admin/layout.tsx", "app/dashboard/admin/layout.tsx"] as const

export type AdminSessionAudit = {
  usesUseSession: boolean
  layoutsPassSession: boolean
  healthy: boolean
}

export function auditAdminSessionBridge(): AdminSessionAudit {
  let usesUseSession = false
  try {
    const src = readFileSync(join(process.cwd(), AUTH_ACTIONS_FILE), "utf8")
    usesUseSession = src.includes("useSession(")
  } catch {
    usesUseSession = true
  }

  let layoutsPassSession = true
  for (const rel of ADMIN_LAYOUT_FILES) {
    try {
      const src = readFileSync(join(process.cwd(), rel), "utf8")
      if (!src.includes("AdminLayoutChrome") || !src.includes("adminNavSessionFromAuth")) {
        layoutsPassSession = false
        break
      }
    } catch {
      layoutsPassSession = false
      break
    }
  }

  return {
    usesUseSession,
    layoutsPassSession,
    healthy: !usesUseSession && layoutsPassSession,
  }
}
