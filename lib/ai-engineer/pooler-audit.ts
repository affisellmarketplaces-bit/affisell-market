import { readFileSync } from "node:fs"
import { join } from "node:path"

import { getPrismaDirectDatasourceUrl } from "@/lib/prisma-datasource-url"

const POOLER_FIX_MARKER = "parsed.hostname.replace(/-pooler/g"
const POOLER_FIX_FILE = "lib/ensure-database-url-unpooled.ts"

export type PoolerAudit = {
  directUrlHasPooler: boolean
  directHost: string | null
  poolerStripPresent: boolean
  healthy: boolean
}

export function auditFulfillmentPoolerConfig(): PoolerAudit {
  let poolerStripPresent = false
  try {
    const src = readFileSync(join(process.cwd(), POOLER_FIX_FILE), "utf8")
    poolerStripPresent = src.includes(POOLER_FIX_MARKER)
  } catch {
    poolerStripPresent = false
  }

  const directUrl = getPrismaDirectDatasourceUrl()
  let directHost: string | null = null
  let directUrlHasPooler = false
  if (directUrl) {
    try {
      directHost = new URL(directUrl).hostname
      directUrlHasPooler = directHost.includes("-pooler")
    } catch {
      directUrlHasPooler = false
    }
  }

  const healthy = poolerStripPresent && !directUrlHasPooler

  return { directUrlHasPooler, directHost, poolerStripPresent, healthy }
}

export function buildPoolerStripPatch(): { file: string; content: string } | null {
  const audit = auditFulfillmentPoolerConfig()
  if (audit.healthy) return null

  const file = POOLER_FIX_FILE
  let content: string
  try {
    content = readFileSync(join(process.cwd(), file), "utf8")
  } catch {
    return null
  }

  if (content.includes(POOLER_FIX_MARKER)) {
    return null
  }

  const needle = "if (parsed.hostname.includes(\"-pooler\")) {"
  if (!content.includes(needle)) {
    const insert = `
    if (parsed.hostname.includes("-pooler")) {
      parsed.hostname = parsed.hostname.replace(/-pooler/g, "")
    }`
    const tryBlock = content.indexOf("try {")
    if (tryBlock === -1) return null
    const parsedLine = content.indexOf("const parsed = new URL(direct)", tryBlock)
    if (parsedLine === -1) return null
    const afterParsed = content.indexOf("\n", parsedLine) + 1
    content = content.slice(0, afterParsed) + insert + content.slice(afterParsed)
  }

  return { file, content }
}
