/**
 * Affisell V1 — Pre-launch Go/No-Go audit (read-only).
 * Run: npx tsx lib/launch/prelaunch-audit.ts
 *  or: npm run audit:prelaunch
 *
 * Never prints secret values. Never mutates the repo or DB.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

type Check = {
  name: string
  ok: boolean
  value?: string | number | boolean | null
  detail?: string
  files?: string[]
  severity?: "blocker" | "warn" | "info"
}

type Section = {
  status: "pass" | "fail" | "warn" | "pending"
  checks: Check[]
}

type Report = {
  generatedAt: string
  build: Section
  database: Section
  env: Section
  security: Section
  payments: Section
  performance: Section
  seo: Section
  legal: Section
  features: Section
  final: {
    go: boolean
    score: number
    okCount: number
    total: number
    blockers: string[]
    verdict: "GO" | "NO-GO" | "GO WITH WARNINGS"
  }
}

const ROOT = process.cwd()

function abs(...parts: string[]): string {
  return join(ROOT, ...parts)
}

function exists(...parts: string[]): boolean {
  return existsSync(abs(...parts))
}

function readText(...parts: string[]): string {
  try {
    return readFileSync(abs(...parts), "utf8")
  } catch {
    return ""
  }
}

function checkGitignored(pattern: string): boolean {
  const gi = readText(".gitignore")
  if (!gi) return false
  return gi.split("\n").some((line) => {
    const t = line.trim()
    if (!t || t.startsWith("#")) return false
    return t === pattern || t.includes(pattern)
  })
}

function getAllFiles(dirRel: string, exts = [".ts", ".tsx", ".js", ".jsx", ".mjs"]): string[] {
  const root = abs(dirRel)
  if (!existsSync(root)) return []
  const out: string[] = []

  const walk = (dir: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".next" || name === "dist" || name === "coverage") continue
      const full = join(dir, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) walk(full)
      else if (exts.some((e) => name.endsWith(e))) out.push(full)
    }
  }

  walk(root)
  return out
}

function rel(p: string): string {
  return relative(ROOT, p)
}

/** Detect hardcoded secrets — returns true if SUSPICIOUS patterns found. */
function scanForSecrets(): { dirty: boolean; hits: string[] } {
  const hits: string[] = []
  const roots = ["app", "lib", "components", "scripts"]
  const patterns: { re: RegExp; label: string }[] = [
    { re: /sk_live_[A-Za-z0-9]{20,}/g, label: "stripe_live_key" },
    { re: /rk_live_[A-Za-z0-9]{20,}/g, label: "stripe_restricted_live" },
    { re: /whsec_[A-Za-z0-9]{20,}/g, label: "stripe_webhook_secret" },
    { re: /AKIA[0-9A-Z]{16}/g, label: "aws_access_key" },
    { re: /-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----/g, label: "private_key_pem" },
    { re: /ghp_[A-Za-z0-9]{36,}/g, label: "github_pat" },
  ]

  for (const root of roots) {
    for (const file of getAllFiles(root)) {
      const text = readFileSync(file, "utf8")
      for (const { re, label } of patterns) {
        re.lastIndex = 0
        if (re.test(text)) {
          hits.push(`${label}:${rel(file)}`)
        }
      }
    }
  }
  return { dirty: hits.length > 0, hits: hits.slice(0, 10) }
}

function checkApiAuthSample(): { ok: boolean; detail: string } {
  const cronDir = abs("app/api/cron")
  let cronRoutes = 0
  let cronWithAuthHint = 0
  if (existsSync(cronDir)) {
    const files = getAllFiles("app/api/cron")
    for (const f of files) {
      if (!f.endsWith("route.ts")) continue
      cronRoutes += 1
      const text = readFileSync(f, "utf8")
      if (text.includes("CRON_SECRET") || text.includes("authorizeCron") || text.includes("authorize-cron")) {
        cronWithAuthHint += 1
      }
    }
  }

  const dashSession = exists("lib/dashboard-session.ts")
  const dashText = readText("lib/dashboard-session.ts")
  const hasRequire =
    dashText.includes("requireAffiliateSession") &&
    dashText.includes("requireSupplierSession")

  const ok = dashSession && hasRequire && (cronRoutes === 0 || cronWithAuthHint / cronRoutes >= 0.5)
  return {
    ok,
    detail: `dashboard-session=${hasRequire}; cron auth ${cronWithAuthHint}/${cronRoutes}`,
  }
}

function envKeyPresentInFile(fileRel: string, key: string): boolean {
  const text = readText(fileRel)
  if (!text) return false
  const re = new RegExp(`(^|\\n)\\s*${key}\\s*=`, "m")
  return re.test(text) || text.includes(`${key}=`) || text.includes(`${key} `)
}

/** Presence only — never returns values. */
function envKeySetLocally(key: string): boolean {
  if (process.env[key]?.trim()) return true
  return envKeyPresentInFile(".env.local", key) || envKeyPresentInFile(".env", key)
}

function stripeLiveVsTestHint(): Check {
  const local = readText(".env.local") + "\n" + readText(".env")
  const hasLive = /STRIPE_SECRET_KEY\s*=\s*["']?sk_live_/.test(local)
  const hasTest = /STRIPE_SECRET_KEY\s*=\s*["']?sk_test_/.test(local)
  if (hasLive && !hasTest) {
    return {
      name: "Stripe key mode (local env)",
      ok: true,
      value: "live",
      detail: "sk_live detected in local env (do not commit)",
      severity: "info",
    }
  }
  if (hasTest) {
    return {
      name: "Stripe key mode (local env)",
      ok: true,
      value: "test",
      detail: "sk_test in local — prod Vercel must use sk_live before launch",
      severity: "warn",
    }
  }
  return {
    name: "Stripe key mode (local env)",
    ok: envKeySetLocally("STRIPE_SECRET_KEY"),
    value: "unknown",
    detail: "Key present but mode not detected (or empty placeholder)",
    severity: "warn",
  }
}

function finalizeSection(section: Section): void {
  const checks = section.checks
  if (checks.length === 0) {
    section.status = "pending"
    return
  }
  const blockers = checks.filter((c) => !c.ok && c.severity === "blocker")
  const fails = checks.filter((c) => !c.ok)
  const warns = checks.filter((c) => c.ok && c.severity === "warn")
  if (blockers.length > 0 || fails.length > 0) section.status = "fail"
  else if (warns.length > 0) section.status = "warn"
  else section.status = "pass"
}

function push(
  section: Section,
  name: string,
  ok: boolean,
  extra?: Partial<Check>
): void {
  section.checks.push({ name, ok, severity: ok ? "info" : "warn", ...extra })
}

async function audit(): Promise<Report> {
  const report: Report = {
    generatedAt: new Date().toISOString(),
    build: { status: "pending", checks: [] },
    database: { status: "pending", checks: [] },
    env: { status: "pending", checks: [] },
    security: { status: "pending", checks: [] },
    payments: { status: "pending", checks: [] },
    performance: { status: "pending", checks: [] },
    seo: { status: "pending", checks: [] },
    legal: { status: "pending", checks: [] },
    features: { status: "pending", checks: [] },
    final: {
      go: false,
      score: 0,
      okCount: 0,
      total: 0,
      blockers: [],
      verdict: "NO-GO",
    },
  }

  // ─── 1. BUILD ───
  console.log("🔨 CHECK BUILD...")
  let pkg: {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  } = {}
  try {
    pkg = JSON.parse(readText("package.json") || "{}") as typeof pkg
  } catch {
    pkg = {}
  }
  push(report.build, "package.json exists", !!pkg.dependencies)
  push(report.build, "Next.js version", !!pkg.dependencies?.next, {
    value: pkg.dependencies?.next ?? null,
  })
  push(report.build, "next.config present", exists("next.config.ts") || exists("next.config.js") || exists("next.config.mjs"))
  push(report.build, "TypeScript config", exists("tsconfig.json"))
  push(report.build, ".env not tracked pattern", checkGitignored(".env") || checkGitignored(".env*.local"), {
    detail: ".gitignore covers .env / .env*.local",
  })
  push(report.build, ".cursor / rules policy", true, {
    detail: checkGitignored(".cursor")
      ? ".cursor in gitignore"
      : "Tracked .cursor/rules (intentional) — secrets stay out via push:safe",
    severity: "info",
  })
  push(report.build, "public/generated in gitignore", checkGitignored("public/generated"), {
    severity: checkGitignored("public/generated") ? "info" : "blocker",
  })
  push(report.build, "npm build script", !!pkg.scripts?.build)
  push(report.build, "check:client-prisma script", !!pkg.scripts?.["check:client-prisma"] || !!pkg.scripts?.build?.includes("check:client-prisma"))

  const scanRoots = ["app", "lib", "components"]
  const todoFiles: string[] = []
  const fixmeFiles: string[] = []
  let consoleLogHits = 0
  for (const root of scanRoots) {
    for (const file of getAllFiles(root)) {
      if (rel(file).includes("lib/launch/prelaunch-audit")) continue
      const text = readFileSync(file, "utf8")
      if (/\bFIXME\b/.test(text)) fixmeFiles.push(rel(file))
      else if (/\bTODO\b/.test(text)) todoFiles.push(rel(file))
      const matches = text.match(/console\.log\(/g)
      if (matches) consoleLogHits += matches.length
    }
  }
  const criticalTodos = [...new Set([...fixmeFiles, ...todoFiles])]
  push(report.build, "TODO/FIXME count", criticalTodos.length < 25, {
    value: criticalTodos.length,
    files: criticalTodos.slice(0, 8),
    detail: `FIXME=${fixmeFiles.length} TODO-bearing files=${todoFiles.length}`,
    severity: criticalTodos.length < 25 ? "info" : "warn",
  })
  push(report.build, "console.log volume (info)", true, {
    value: consoleLogHits,
    detail: "Affisell requires prefixed business logs — volume is expected",
    severity: "info",
  })
  // ─── 2. DATABASE ───
  console.log("🗄️ CHECK DB...")
  const schema = readText("prisma/schema.prisma")
  push(report.database, "schema.prisma exists", schema.length > 0, {
    severity: schema ? "info" : "blocker",
  })
  for (const model of [
    "ProductRequest",
    "ProductQuote",
    "BubbleLink",
    "SupplierMetrics",
    "DeliveryReview",
    "Product",
    "Order",
    "User",
    "AffiliateProduct",
  ]) {
    push(report.database, `model ${model}`, schema.includes(`model ${model}`), {
      severity: schema.includes(`model ${model}`) ? "info" : "blocker",
    })
  }
  let migrations: string[] = []
  try {
    migrations = readdirSync(abs("prisma/migrations")).filter((n) => {
      if (n.startsWith(".") || n === "migration_lock.toml") return false
      try {
        return statSync(abs("prisma/migrations", n)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    migrations = []
  }
  migrations.sort()
  push(report.database, "Migrations count", migrations.length > 0, {
    value: migrations.length,
    severity: migrations.length > 0 ? "info" : "blocker",
  })
  push(report.database, "Last migration", migrations.length > 0, {
    value: migrations[migrations.length - 1] ?? null,
  })
  push(report.database, "BubbleLink migration folder", migrations.some((m) => m.includes("bubble_link")))

  // ─── 3. ENV ───
  console.log("🔑 CHECK ENV...")
  const envExample = readText(".env.example")
  push(report.env, ".env.example exists", envExample.length > 0, {
    severity: envExample ? "info" : "blocker",
  })
  push(report.env, ".env.local.example exists", exists(".env.local.example"))

  const requiredInExample = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_FROM_EMAIL",
    "CRON_SECRET",
  ]
  for (const key of requiredInExample) {
    const inExample = envExample.includes(key)
    push(report.env, `ENV ${key} in .env.example`, inExample, {
      severity: inExample ? "info" : "warn",
    })
  }
  // Local presence (boolean only)
  for (const key of ["DATABASE_URL", "NEXTAUTH_SECRET", "STRIPE_SECRET_KEY"]) {
    const set = envKeySetLocally(key) || envKeySetLocally(key === "NEXTAUTH_SECRET" ? "AUTH_SECRET" : key)
    push(report.env, `Local ${key} set (presence)`, set, {
      detail: "Value never printed",
      severity: set ? "info" : "warn",
    })
  }
  report.env.checks.push(stripeLiveVsTestHint())
  push(report.env, "AUTH_SECRET or NEXTAUTH_SECRET documented", envExample.includes("AUTH_SECRET") || envExample.includes("NEXTAUTH_SECRET"))

  // ─── 4. SECURITY ───
  console.log("🔒 CHECK SECURITY...")
  push(report.security, "next-auth / Auth.js lib", exists("lib/auth.ts") || exists("auth.ts"), {
    severity: "blocker",
  })
  push(
    report.security,
    "NextAuth route",
    exists("app/api/auth/[...nextauth]/route.ts") || exists("app/api/auth/[...nextauth]/route.js"),
    { severity: "blocker" }
  )
  // Next.js 16 Affisell uses proxy.ts as middleware entry
  push(
    report.security,
    "Edge proxy / middleware",
    exists("proxy.ts") || exists("middleware.ts") || exists("app/middleware.ts"),
    { detail: exists("proxy.ts") ? "proxy.ts (Next 16)" : "middleware.ts", severity: "blocker" }
  )
  const secretScan = scanForSecrets()
  push(report.security, "No hardcoded live secrets in source", !secretScan.dirty, {
    files: secretScan.hits,
    severity: secretScan.dirty ? "blocker" : "info",
  })
  const apiAuth = checkApiAuthSample()
  push(report.security, "API / dashboard auth patterns", apiAuth.ok, {
    detail: apiAuth.detail,
    severity: apiAuth.ok ? "info" : "blocker",
  })
  push(report.security, "verify:no-secrets script", exists("scripts/verify-no-secrets.mjs"))
  push(report.security, "push:safe secret scan", !!pkg.scripts?.["push:safe"])

  // ─── 5. PAYMENTS ───
  console.log("💳 CHECK PAYMENTS...")
  push(
    report.payments,
    "Stripe webhook route",
    exists("app/api/webhooks/stripe/route.ts") || exists("app/api/stripe/webhook/route.ts"),
    { severity: "blocker" }
  )
  push(
    report.payments,
    "Stripe checkout create",
    exists("app/api/stripe/create-checkout/route.ts") || getAllFiles("app/api/stripe").length > 0,
    { severity: "blocker" }
  )
  push(report.payments, "Stripe libs present", getAllFiles("lib").some((f) => rel(f).includes("stripe")), {
    value: getAllFiles("lib").filter((f) => rel(f).includes("stripe")).length,
  })
  push(report.payments, "Connect / payout code", exists("lib/stripe-connect-transfer.ts") || exists("app/api/stripe/connect/route.ts"))
  push(report.payments, "Order model for settlement", schema.includes("model Order"))

  // ─── 6. PERFORMANCE ───
  console.log("⚡ CHECK PERFORMANCE...")
  const nextConfig = readText("next.config.ts") || readText("next.config.js") || readText("next.config.mjs")
  push(report.performance, "next.config exists", nextConfig.length > 0)
  push(report.performance, "images config hinted", /images\s*:/.test(nextConfig) || nextConfig.includes("remotePatterns"))
  push(report.performance, "sharp dependency", !!pkg.dependencies?.sharp || !!pkg.devDependencies?.sharp, {
    // sharp may be transitive via next
    severity: "info",
  })
  push(report.performance, "optimizePackageImports / experiments", nextConfig.includes("optimizePackageImports") || nextConfig.includes("experimental"))
  push(report.performance, ".next build artifact (optional)", exists(".next"), {
    detail: "Absent until npm run build — not a launch blocker",
    severity: "info",
  })

  // ─── 7. FEATURES ───
  console.log("🚀 CHECK FEATURES...")
  const featurePaths: [string, string][] = [
    ["BubbleProductCard", "components/product/BubbleProductCard.tsx"],
    ["Bubble page", "app/product/[id]/bubble/page.tsx"],
    ["Social asset generator", "lib/social/social-asset-generator.ts"],
    ["Delivery SLA lib", "lib/logistics/delivery-sla.ts"],
    ["Supplier score lib", "lib/logistics/supplier-score.ts"],
    ["Requests API", "app/api/requests/route.ts"],
    ["Quotes API", "app/api/requests/[id]/quotes/route.ts"],
    ["Radar terminal", "components/radar/world-radar-terminal.tsx"],
    ["Viral command center", "app/dashboard/reseller/products/[id]/social/page.tsx"],
    ["Bubble short link", "app/b/[token]/page.tsx"],
  ]
  for (const [name, path] of featurePaths) {
    push(report.features, name, exists(path), { value: path, severity: exists(path) ? "info" : "warn" })
  }

  // ─── 8. SEO ───
  console.log("🔍 CHECK SEO...")
  push(report.seo, "OG bubble image", exists("app/product/[id]/bubble/opengraph-image.tsx"))
  push(report.seo, "sitemap.ts", exists("app/sitemap.ts") || exists("app/sitemap.xml"))
  push(report.seo, "robots.ts / robots.txt", exists("app/robots.ts") || exists("public/robots.txt"))
  push(report.seo, "manifest", exists("app/manifest.ts") || exists("app/manifest.webmanifest") || exists("public/manifest.webmanifest"))
  push(report.seo, "OG API fallback", exists("app/api/og/route.tsx") || exists("app/api/og/route.ts"))

  // ─── 9. LEGAL ───
  console.log("⚖️ CHECK LEGAL...")
  push(
    report.legal,
    "CGV page",
    exists("app/(legal)/cgv/page.tsx") || exists("app/cgv/page.tsx") || exists("app/legal/terms-of-sale/page.tsx"),
    { severity: "blocker" }
  )
  push(
    report.legal,
    "Privacy page",
    exists("app/(legal)/privacy/page.tsx") || exists("app/privacy/page.tsx") || exists("app/legal/privacy-policy/page.tsx"),
    { severity: "blocker" }
  )
  push(
    report.legal,
    "Mentions légales",
    exists("app/(legal)/mentions-legales/page.tsx") ||
      exists("app/mentions-legales/page.tsx") ||
      exists("app/legal/mentions/page.tsx") ||
      exists("app/legal/legal-notice/page.tsx"),
    { severity: "blocker" }
  )
  push(report.legal, "Legal hub /legal", exists("app/legal/page.tsx"))
  push(report.legal, "Cookies / CGU", exists("app/(legal)/cgu/page.tsx") || exists("app/cgu/page.tsx") || exists("app/cookies/page.tsx") || exists("app/legal/cookie-policy/page.tsx"))

  // ─── FINAL ───
  for (const section of [
    report.build,
    report.database,
    report.env,
    report.security,
    report.payments,
    report.performance,
    report.seo,
    report.legal,
    report.features,
  ]) {
    finalizeSection(section)
  }

  const allChecks = [
    ...report.build.checks,
    ...report.database.checks,
    ...report.env.checks,
    ...report.security.checks,
    ...report.payments.checks,
    ...report.performance.checks,
    ...report.features.checks,
    ...report.seo.checks,
    ...report.legal.checks,
  ]
  const okCount = allChecks.filter((c) => c.ok).length
  const total = allChecks.length
  const blockers = allChecks.filter((c) => !c.ok && c.severity === "blocker").map((c) => c.name)
  const securityOk = report.security.checks.every((c) => c.ok || c.severity !== "blocker")
  const paymentsOk = report.payments.checks.every((c) => c.ok || c.severity !== "blocker")
  const legalOk = report.legal.checks.filter((c) => c.severity === "blocker").every((c) => c.ok)

  report.final.score = total ? Math.round((okCount / total) * 100) : 0
  report.final.okCount = okCount
  report.final.total = total
  report.final.blockers = blockers
  report.final.go =
    report.final.score >= 80 && securityOk && paymentsOk && legalOk && blockers.length === 0

  const warnFails = allChecks.filter((c) => !c.ok && c.severity !== "blocker")
  const softWarns = allChecks.filter((c) => c.ok && c.severity === "warn")
  if (report.final.go && warnFails.length === 0 && softWarns.length === 0) {
    report.final.verdict = "GO"
  } else if (report.final.go) {
    report.final.verdict = "GO WITH WARNINGS"
  } else {
    report.final.verdict = "NO-GO"
  }

  return report
}

function printHuman(report: Report): void {
  const icon = { pass: "✅", fail: "❌", warn: "⚠️", pending: "⏳" } as const
  console.log("\n══════════════════════════════════════════════")
  console.log("  AFFISELL V1 — PRE-LAUNCH AUDIT")
  console.log(`  ${report.generatedAt}`)
  console.log("══════════════════════════════════════════════\n")

  const sections: [string, Section][] = [
    ["BUILD", report.build],
    ["DATABASE", report.database],
    ["ENV", report.env],
    ["SECURITY", report.security],
    ["PAYMENTS", report.payments],
    ["PERFORMANCE", report.performance],
    ["FEATURES", report.features],
    ["SEO", report.seo],
    ["LEGAL", report.legal],
  ]

  for (const [title, section] of sections) {
    console.log(`${icon[section.status]} ${title} [${section.status}]`)
    for (const c of section.checks) {
      const mark = c.ok ? "  ✓" : "  ✗"
      const val = c.value !== undefined && c.value !== null ? ` → ${String(c.value)}` : ""
      const det = c.detail ? ` (${c.detail})` : ""
      console.log(`${mark} ${c.name}${val}${det}`)
      if (c.files?.length) console.log(`      files: ${c.files.join(", ")}`)
    }
    console.log("")
  }

  console.log("──────────────────────────────────────────────")
  console.log(
    `SCORE: ${report.final.score}/100 (${report.final.okCount}/${report.final.total} checks)`
  )
  if (report.final.blockers.length) {
    console.log(`BLOCKERS: ${report.final.blockers.join(" | ")}`)
  }
  console.log(`VERDICT: ${report.final.verdict}`)
  console.log("──────────────────────────────────────────────\n")
}

audit()
  .then((report) => {
    printHuman(report)
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(report, null, 2))
    }
    process.exitCode = report.final.go ? 0 : 1
  })
  .catch((err) => {
    console.error("[prelaunch-audit] failed", err)
    process.exitCode = 2
  })
