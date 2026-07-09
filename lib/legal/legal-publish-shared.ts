import { existsSync } from "node:fs"
import path from "node:path"

const SEMVER_RE = /^\d+\.\d+\.\d+$/

export type PublishArgs = {
  slug: string
  version: string
  locales: string[]
  changelog: string | null
  publishedBy: string
  dryRun: boolean
  setCurrent: boolean
  replace: boolean
}

export function parseArgs(argv: string[]): PublishArgs {
  const positional: string[] = []
  let changelog: string | null = null
  let locales = ["fr"]
  let dryRun = false
  let setCurrent = true
  let replace = false
  let publishedBy = "system:legal-publish"

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--changelog") {
      changelog = argv[++i] ?? null
      continue
    }
    if (arg === "--locale") {
      const raw = argv[++i] ?? "fr"
      locales = raw.split(",").map((l) => l.trim()).filter(Boolean)
      continue
    }
    if (arg === "--dry-run") {
      dryRun = true
      continue
    }
    if (arg === "--no-set-current") {
      setCurrent = false
      continue
    }
    if (arg === "--replace") {
      replace = true
      continue
    }
    if (arg === "--published-by") {
      publishedBy = argv[++i] ?? publishedBy
      continue
    }
    if (arg.startsWith("--")) {
      throw new Error(`[legal:publish] Unknown flag: ${arg}`)
    }
    positional.push(arg)
  }

  const slug = positional[0]
  const version = positional[1]
  if (!slug || !version) {
    throw new Error(
      "[legal:publish] Usage: npm run legal:publish -- <slug> <version> [--locale fr] [--changelog text] [--dry-run] [--replace]"
    )
  }
  if (!SEMVER_RE.test(version)) {
    throw new Error(`[legal:publish] Invalid semver: ${version} (expected e.g. 1.0.0)`)
  }

  return { slug, version, locales, changelog, publishedBy, dryRun, setCurrent, replace }
}

export function agreementPath(slug: string, locale: string): string | null {
  const localized = path.join(process.cwd(), "legal", "agreements", locale, `${slug}.md`)
  if (existsSync(localized)) return localized

  const canonical = path.join(process.cwd(), "legal", "agreements", `${slug}.md`)
  if (locale === "fr" && existsSync(canonical)) return canonical

  return null
}
