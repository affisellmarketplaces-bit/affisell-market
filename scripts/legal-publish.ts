/**
 * Publie une version légale depuis legal/agreements/ vers le LMS Prisma.
 *
 *   npm run legal:publish -- customer 1.0.0
 *   npm run legal:publish -- customer 1.0.0 --replace --changelog "CGU Blueprint v1"
 *   npm run legal:publish -- customer 1.1.0 --changelog "Mise à jour article 5"
 *   npm run legal:publish -- customer 1.0.0 --locale fr --dry-run
 *
 * Source (par ordre de priorité pour une locale) :
 *   legal/agreements/{locale}/{slug}.md
 *   legal/agreements/{slug}.md  (canonique FR)
 */

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "dotenv"
import matter from "gray-matter"
import { PrismaClient } from "@prisma/client"

import { agreementPath, parseArgs } from "@/lib/legal/legal-publish-shared"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const DEFAULT_TITLES: Record<string, string> = {
  customer: "Conditions Générales d'Utilisation",
  "terms-of-sale": "Conditions Générales de Vente",
  supplier: "Conditions Fournisseur",
  affiliate: "Conditions Affilié",
  privacy: "Politique de Confidentialité",
}

type LoadedAgreement = {
  content: string
  title: string
  fileVersion: string | null
  filePath: string
}

function loadAgreement(slug: string, locale: string): LoadedAgreement {
  const filePath = agreementPath(slug, locale)
  if (!filePath) {
    throw new Error(
      `[legal:publish] Missing source for slug=${slug} locale=${locale} (expected legal/agreements/${slug}.md or legal/agreements/${locale}/${slug}.md)`
    )
  }

  const raw = readFileSync(filePath, "utf8")
  const parsed = matter(raw)
  const title =
    typeof parsed.data.title === "string" && parsed.data.title.trim()
      ? parsed.data.title.trim()
      : DEFAULT_TITLES[slug] ?? slug

  const fileVersion =
    typeof parsed.data.version === "string" ? parsed.data.version.trim() : null

  return { content: raw, title, fileVersion, filePath }
}

async function publishLocale(
  args: ReturnType<typeof parseArgs>,
  locale: string
): Promise<{ versionId: string; contentHash: string; created: boolean }> {
  const loaded = loadAgreement(args.slug, locale)
  const contentHash = createHash("sha256").update(loaded.content).digest("hex")

  if (loaded.fileVersion && loaded.fileVersion !== args.version) {
    console.warn("[legal:publish]", {
      slug: args.slug,
      locale,
      fileVersion: loaded.fileVersion,
      cliVersion: args.version,
      result: "version_mismatch",
      hint: "Update frontmatter version in source file",
    })
  }

  const doc = await prisma.legalDocument.findUnique({
    where: { slug: args.slug },
    select: { id: true },
  })
  if (!doc) {
    throw new Error(
      `[legal:publish] LegalDocument slug="${args.slug}" not found — run npm run legal:seed first`
    )
  }

  const existing = await prisma.legalVersion.findUnique({
    where: {
      documentId_version_language: {
        documentId: doc.id,
        version: args.version,
        language: locale,
      },
    },
    select: { id: true, contentHash: true },
  })

  if (existing && existing.contentHash !== contentHash && !args.replace) {
    throw new Error(
      `[legal:publish] Version ${args.version} (${locale}) already exists with different contentHash. Bump semver or pass --replace.`
    )
  }

  if (args.dryRun) {
    console.log("[legal:publish]", {
      slug: args.slug,
      version: args.version,
      locale,
      contentHash,
      source: loaded.filePath,
      wouldReplace: Boolean(existing && existing.contentHash !== contentHash),
      result: "dry_run",
    })
    return { versionId: existing?.id ?? "(new)", contentHash, created: !existing }
  }

  const version = await prisma.legalVersion.upsert({
    where: {
      documentId_version_language: {
        documentId: doc.id,
        version: args.version,
        language: locale,
      },
    },
    update: {
      content: loaded.content,
      contentHash,
      title: loaded.title,
      changelog: args.changelog ?? undefined,
      publishedBy: args.publishedBy,
    },
    create: {
      documentId: doc.id,
      version: args.version,
      language: locale,
      title: loaded.title,
      content: loaded.content,
      contentHash,
      publishedBy: args.publishedBy,
      changelog: args.changelog ?? `Published from ${path.basename(loaded.filePath)}`,
    },
    select: { id: true },
  })

  const created = !existing
  console.log("[legal:publish]", {
    slug: args.slug,
    version: args.version,
    locale,
    versionId: version.id,
    contentHash,
    created,
    replaced: Boolean(existing && !created),
    result: "ok",
  })

  return { versionId: version.id, contentHash, created }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  let frVersionId: string | null = null

  for (const locale of args.locales) {
    try {
      const result = await publishLocale(args, locale)
      if (locale === "fr") {
        frVersionId = result.versionId
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("Missing source")) {
        console.log("[legal:publish]", { slug: args.slug, locale, result: "skipped_no_source" })
        continue
      }
      throw err
    }
  }

  if (!frVersionId || frVersionId === "(new)") {
    if (!args.dryRun && args.setCurrent) {
      throw new Error("[legal:publish] No FR version published — cannot update currentVersionId")
    }
    return
  }

  if (args.setCurrent && !args.dryRun) {
    const doc = await prisma.legalDocument.findUnique({
      where: { slug: args.slug },
      select: { id: true, currentVersionId: true },
    })
    if (!doc) return

    if (doc.currentVersionId !== frVersionId) {
      await prisma.legalDocument.update({
        where: { id: doc.id },
        data: { currentVersionId: frVersionId },
      })
      console.log("[legal:publish]", {
        slug: args.slug,
        currentVersionId: frVersionId,
        result: "current_updated",
      })
    } else {
      console.log("[legal:publish]", {
        slug: args.slug,
        currentVersionId: frVersionId,
        result: "current_unchanged",
      })
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error("[legal:publish]", err)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
