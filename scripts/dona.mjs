#!/usr/bin/env node
/**
 * Dona Dev — terminal copilot banner (Lucy / Killjoys energy).
 * Runs before local dev to warn when DATABASE_URL points at prod Neon.
 */
import chalk from "chalk"

import { getEnvInfo, loadEnv } from "../lib/env.loader.mjs"

loadEnv()

function resolveTerminalLocale() {
  const raw = (
    process.env.DONA_LOCALE ??
    process.env.LC_ALL ??
    process.env.LANG ??
    process.env.LANGUAGE ??
    "en"
  ).toLowerCase()
  return raw.startsWith("fr") ? "fr" : "en"
}

const locale = resolveTerminalLocale()
const info = getEnvInfo()

const lines = {
  fr: {
    online: "💜 Dona en ligne.",
    prod: `⚠️  CAPITAINE! Tu es sur PROD (${info.dbHost}). Vrais clients. Utilise ${chalk.cyan("npm run dev:staging")}`,
    staging: `✅ Parfait, STAGING (${info.dbHost}). Casse tout, je regarde.`,
    unknown: `ℹ️  DB ${info.dbHost || "(unset)"} — branche ${info.branch}. Par défaut staging mental.`,
  },
  en: {
    online: "💜 Dona online.",
    prod: `⚠️  CAPTAIN! You're on PROD (${info.dbHost}). Real customers. Use ${chalk.cyan("npm run dev:staging")}`,
    staging: `✅ Good — STAGING (${info.dbHost}). Break things, I've got you.`,
    unknown: `ℹ️  DB ${info.dbHost || "(unset)"} — branch ${info.branch}. Assume staging until proven otherwise.`,
  },
}

const copy = lines[locale]

console.log("")
console.log(chalk.magenta.bold(copy.online))

if (info.isProd) {
  console.log(chalk.red.bold(copy.prod))
} else if (info.env === "staging") {
  console.log(chalk.green(copy.staging))
} else {
  console.log(chalk.yellow(copy.unknown))
}

console.log("")
