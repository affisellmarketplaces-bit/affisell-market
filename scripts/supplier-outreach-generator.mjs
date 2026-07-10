#!/usr/bin/env node
/**
 * Supplier cold outreach — CSV in → personalized messages JSON out.
 *
 * Usage:
 *   node scripts/supplier-outreach-generator.mjs brands.csv > messages.json
 *
 * Input columns: brand, domain, email, firstName, linkedin (header row required)
 * Output: JSON array [{ email, subject, body }]
 */
import fs from "node:fs"
import { resolve } from "node:path"
import { config } from "dotenv"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const CALENDLY_URL =
  process.env.OUTREACH_CALENDLY_URL?.trim() ||
  process.env.ONBOARDING_CALENDLY_URL?.trim() ||
  "https://calendly.com/affisell/demo"

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

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]?.trim() ?? ""]))
  })
}

function buildMessage(record) {
  const brand = record.brand?.trim() || "ta marque"
  const firstName =
    record.firstName?.trim() ||
    record.firstname?.trim() ||
    brand.split(" ")[0] ||
    "là"
  const subject = "Vendre en Europe sans ads?"
  const body = `Salut ${firstName},

J'ai vu ${brand} sur Shopify. Tu ship en Europe?

Affisell = marketplace 1000 affiliés FR.
- KYC 5min
- Payout J+2 garanti
- 0 stock à gérer, 0 pub à payer

Tu veux tester? Demo 10min : ${CALENDLY_URL}

Nelson
P.S: Nos top SUPPLIER font 15k€/mois`

  return {
    email: record.email?.trim(),
    subject,
    body: body.replace(/\n/g, "\\n"),
  }
}

function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error("Usage: node scripts/supplier-outreach-generator.mjs brands.csv > messages.json")
    process.exit(1)
  }

  const csv = fs.readFileSync(resolve(inputPath), "utf-8")
  const records = parseCsv(csv)
  const output = records
    .filter((r) => r.email?.trim())
    .map((r) => buildMessage(r))

  console.log(JSON.stringify(output, null, 2))
  console.error(`[supplier-outreach-generator] generated ${output.length} messages (calendly=${CALENDLY_URL})`)
}

main()
