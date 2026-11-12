/**
 * World Radar seed — the env FILES, read in memory (RSK-90, lot A). Read-only: it parses, it never writes to `process.env`
 * (the old seed loaded three files with `override: true`, so a file could overwrite a variable the operator had set in the shell).
 *
 * It returns data and nothing else: it cannot mint a token, create a client or print a value. Only the four target variables are
 * kept from a file; every other key is dropped as soon as the file is parsed. Values stay in memory and are never logged.
 *
 *   `.env.local`, `.env`          sources of the target (precedence `.env.local` > `.env`, below the shell)
 *   `.env.pre-local-merge.bak`    NOT a source: a one-shot migration backup the old scripts also loaded. Only the NAMES of the
 *                                 target variables it defines are reported, so the operator knows they are ignored.
 *
 * In every file the program also looks — by NAME only, with a regular expression on the key, never by parsing a value — for the two
 * `AFFISELL_ALLOW_*` confirmations (a confirmation written in a file was not typed for this invocation, so it is refused) and, in the
 * two real sources, for the guarded variables (`DOTENV_KEY`, the engine / injection variables): names, never values.
 *
 * `inspectEnvSurface` reports which OTHER env files exist (existence and names only) and `readClientConfig` reads the TEXT of the
 * generated Radar client before that client is required. Both return data; neither can fail the program by throwing.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import { basename, dirname, join } from "node:path"

import { parse } from "dotenv"

import { ALLOW_VARIABLES, GUARDED_VARIABLES, TARGET_VARIABLES } from "./radar-entry-snapshot.mjs"

/** Precedence order of the two real sources, then the ignored backup. */
const SOURCE_FILES = [
  { label: ".env.local", resolution: true },
  { label: ".env", resolution: true },
  { label: ".env.pre-local-merge.bak", resolution: false },
]

/** @param {string} text @param {readonly string[]} names @returns {string[]} the names defined as a KEY of the file (a comment never counts) */
function definedNames(text, names) {
  return names.filter((name) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`, "m").test(text))
}

/**
 * @param {string} root repository root
 * @returns {{
 *   files: Array<{ label: string, resolution: boolean, values: Record<string, string>, definedTargetNames: string[], allowNames: string[], guardedNames: string[] }>,
 *   unreadable: string[],
 * }}
 */
export function readRadarSources(root) {
  const files = []
  const unreadable = []
  for (const { label, resolution } of SOURCE_FILES) {
    const path = join(root, label)
    if (!existsSync(path)) continue
    let text
    try {
      text = readFileSync(path, "utf8")
    } catch {
      unreadable.push(label)
      continue
    }
    const allowNames = definedNames(text, ALLOW_VARIABLES)
    /** @type {Record<string, string>} */
    const values = {}
    if (resolution) {
      const parsed = parse(text)
      for (const name of TARGET_VARIABLES) if (Object.hasOwn(parsed, name)) values[name] = parsed[name]
    }
    files.push({
      label,
      resolution,
      values,
      definedTargetNames: resolution ? Object.keys(values) : definedNames(text, TARGET_VARIABLES),
      allowNames,
      guardedNames: resolution ? definedNames(text, GUARDED_VARIABLES) : [],
    })
  }
  return { files, unreadable }
}

/**
 * Which OTHER env files exist. `existing` are files the generated client or dotenv could read INSTEAD of the one the seed examined
 * (`prisma/.env`, `.env.vault`); `unreadEnvFiles` are the NAMES of the `.env*` files at the root that the seed does not read
 * (templates excluded). Nothing is opened.
 * @param {string} root
 * @returns {{ existing: string[], unreadEnvFiles: string[] }}
 */
export function inspectEnvSurface(root) {
  /** @type {string[]} */
  const existing = []
  for (const name of ["prisma/.env", ".env.vault"]) if (existsSync(join(root, name))) existing.push(name)
  /** @type {string[]} */
  let unreadEnvFiles = []
  try {
    unreadEnvFiles = readdirSync(root)
      .filter((name) => /^\.env(\..+)?$/.test(name) && name !== ".env.vault" && !/\.(example|template)$/.test(name) && !SOURCE_FILES.some((file) => file.label === name))
      .sort()
  } catch {
    unreadEnvFiles = []
  }
  return { existing, unreadEnvFiles }
}

/**
 * The TEXT of the generated client's entry file, with the folders it must be judged against. It is read from the path the module
 * resolver gave, before the module is required. Any failure is data (`ok: false`), never an exception.
 * @param {string} indexPath absolute path of the client's index file
 * @param {string} repoRoot
 * @returns {{ ok: boolean, text?: string, clientDir?: string, expectedClientDir?: string, repoRoot?: string, schemaBeside?: boolean }}
 */
export function readClientConfig(indexPath, repoRoot) {
  try {
    const clientDir = realpathSync(dirname(indexPath))
    return {
      ok: true,
      text: readFileSync(join(clientDir, basename(indexPath)), "utf8"),
      clientDir,
      expectedClientDir: realpathSync(join(repoRoot, "node_modules", ".prisma", "client-mi")),
      repoRoot: realpathSync(repoRoot),
      schemaBeside: existsSync(join(clientDir, "schema.prisma")),
    }
  } catch {
    return { ok: false }
  }
}
