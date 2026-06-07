#!/usr/bin/env node
/**
 * Translate legal/content/{source}/*.md → legal/content/{locale}/*.md via Groq.
 * Usage: node --import dotenv/config --env-file=.env.local scripts/i18n-translate-legal-md.mjs --source=en --locale=es
 *        node --import dotenv/config --env-file=.env.local scripts/i18n-translate-legal-md.mjs --source=en --locale=es,it,nl,pl,zh
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import Groq from "groq-sdk"
import matter from "gray-matter"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE_LOCALE = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1]?.trim() || "fr"
const srcDir = path.join(root, "legal/content", SOURCE_LOCALE)
const GROQ_MODEL = process.env.GROQ_I18N_MODEL?.trim() || "llama-3.3-70b-versatile"

const LOCALE_NAMES = {
  en: "English",
  de: "German (Deutsch)",
  es: "Spanish (Español)",
  it: "Italian (Italiano)",
  nl: "Dutch (Nederlands)",
  pl: "Polish (Polski)",
  zh: "Simplified Chinese (简体中文)",
}

const PLACEHOLDER_TOKENS = [
  "{{COMPANY_NAME}}",
  "{{SIREN}}",
  "{{SIRET}}",
  "{{RCS}}",
  "{{TVA}}",
  "{{CAPITAL}}",
  "{{ADRESSE}}",
  "{{LAST_UPDATED}}",
  "{{DPO}}",
  "{{EMAIL}}",
  "{{SUPPORT_EMAIL}}",
  "{{CONTACT_EMAIL}}",
  "{{PUBLISHER}}",
  "{{MEDIATOR_URL}}",
  "{{SUPPLIER_CATALOG_FEE}}",
  "{{SUPPLIER_AUTO_BUY_FEE}}",
  "{{AFFILIATE_EARNINGS_FEE}}",
  "{{LEGACY_ORDER_FEE}}",
  "{{PAYOUT_DAYS}}",
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function translateMarkdown(groq, body, langLabel) {
  const prompt = `You are a professional legal/UI translator for Affisell, a European marketplace.

Translate the following legal markdown document body to ${langLabel}.

Rules:
- Keep YAML frontmatter keys unchanged (only translate title and description values in frontmatter separately).
- Do NOT translate: Affisell, Stripe, PayPal, RGPD/GDPR as acronyms, WCAG, EU, ODR, SIRET, SIREN, CM2C, CNIL, Vercel, Shopify
- Keep ALL placeholders EXACTLY unchanged: ${PLACEHOLDER_TOKENS.join(", ")}
- Keep markdown links paths unchanged: (/cgv), (/privacy), (/returns), (/cgu), (/legal/...), (/dashboard/...)
- Keep email mailto links structure
- Use formal but readable tone for legal content
- Return ONLY the translated markdown body (no frontmatter, no code fences)

Source markdown body:
${body}`

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 8192,
      })
      return completion.choices[0]?.message?.content?.trim() ?? body
    } catch (err) {
      const wait = 30_000 * (attempt + 1)
      console.warn(`[legal-md] rate/error, waiting ${wait / 1000}s`, err?.message ?? err)
      await sleep(wait)
    }
  }
  return body
}

async function translateFrontmatter(groq, data, langLabel) {
  const payload = { title: data.title ?? "", description: data.description ?? "" }
  const prompt = `Translate these JSON string values to ${langLabel}. Keep keys. Return JSON only.
${JSON.stringify(payload)}`
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.1,
  })
  const raw = completion.choices[0]?.message?.content ?? "{}"
  return { ...JSON.parse(raw) }
}

async function translateFile(groq, file, locale, langLabel) {
  const raw = fs.readFileSync(path.join(srcDir, file), "utf8")
  const { data, content } = matter(raw)
  console.log(`[legal-md] ${locale} ← ${file}`)
  const fm = await translateFrontmatter(groq, data, langLabel)
  const body = await translateMarkdown(groq, content.trim(), langLabel)
  const out = matter.stringify(`\n${body}\n`, {
    ...data,
    title: fm.title || data.title,
    description: fm.description || data.description,
  })
  const outDir = path.join(root, "legal/content", locale)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, file), out)
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=")
      return [k, v ?? "true"]
    })
  )
  const locales =
    args.all === "true"
      ? Object.keys(LOCALE_NAMES).filter((l) => l !== SOURCE_LOCALE)
      : (args.locale ?? "en").split(",").map((l) => l.trim())

  if (!process.env.GROQ_API_KEY?.trim()) {
    console.error("[legal-md] GROQ_API_KEY required")
    process.exit(1)
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".md"))

  for (const locale of locales) {
    const langLabel = LOCALE_NAMES[locale]
    if (!langLabel) {
      console.warn(`[legal-md] skip unknown locale ${locale}`)
      continue
    }
    for (const file of files) {
      await translateFile(groq, file, locale, langLabel)
    }
  }
  console.log("[legal-md] done")
}

main().catch((err) => {
  console.error("[legal-md] fatal", err)
  process.exit(1)
})
