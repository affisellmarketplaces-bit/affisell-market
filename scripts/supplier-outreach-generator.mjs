#!/usr/bin/env node
/**
 * Supplier cold outreach — CSV in → personalized email CSV out.
 *
 * Usage:
 *   node scripts/supplier-outreach-generator.mjs input.csv > output.csv
 *
 * Input columns: brand, domain, email, firstName, linkedin (header row required)
 * Output columns: email, subject, body
 */
import { createReadStream } from "node:fs"
import { resolve } from "node:path"
import { createInterface } from "node:readline"
import { config } from "dotenv"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const CALENDLY =
  process.env.ONBOARDING_CALENDLY_URL?.trim() ||
  "https://calendly.com/affisell/demo-10min"

function parseCsvLine(line) {
  const cells = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      cells.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

function escapeCsv(value) {
  const text = String(value ?? "")
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function buildSubject() {
  return "Vendre en Europe sans ads?"
}

function buildBody({ firstName, brand }) {
  const greeting = firstName?.trim() ? `Salut ${firstName.trim()},` : "Salut,"
  const brandLabel = brand?.trim() || "ta marque"

  return `${greeting}

J'ai vu ${brandLabel} sur Shopify. Tu ship en Europe?

Affisell = marketplace 1000 affiliés FR.
- KYC 5min
- Payout J+2 garanti
- 0 stock à gérer, 0 pub à payer

Tu veux tester? Demo 10min : ${CALENDLY}

Nelson
P.S: Nos top SUPPLIER font 15k€/mois`
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error("Usage: node scripts/supplier-outreach-generator.mjs input.csv > output.csv")
    process.exit(1)
  }

  const rl = createInterface({
    input: createReadStream(resolve(inputPath), { encoding: "utf8" }),
    crlfDelay: Infinity,
  })

  let headers = null
  let count = 0

  for await (const rawLine of rl) {
    const line = rawLine.replace(/^\uFEFF/, "").trimEnd()
    if (!line.trim()) continue

    const cells = parseCsvLine(line)
    if (!headers) {
      headers = cells.map((h) => h.trim().toLowerCase())
      process.stdout.write(`${escapeCsv("email")},${escapeCsv("subject")},${escapeCsv("body")}\n`)
      continue
    }

    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i]?.trim() ?? ""]))
    const email = row.email
    if (!email) continue

    const subject = buildSubject()
    const body = buildBody({ firstName: row.firstname ?? row.first_name, brand: row.brand })
    process.stdout.write(
      `${escapeCsv(email)},${escapeCsv(subject)},${escapeCsv(body)}\n`
    )
    count++
  }

  if (!headers) {
    console.error("[supplier-outreach-generator] empty or missing header row")
    process.exit(1)
  }

  console.error(`[supplier-outreach-generator] generated ${count} emails (calendly=${CALENDLY})`)
}

main().catch((err) => {
  console.error("[supplier-outreach-generator]", err)
  process.exit(1)
})
