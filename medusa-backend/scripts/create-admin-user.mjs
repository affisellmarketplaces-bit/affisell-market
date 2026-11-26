#!/usr/bin/env node
/**
 * Create the Medusa admin user from MEDUSA_ADMIN_EMAIL / MEDUSA_ADMIN_PASSWORD (medusa-backend/.env).
 *
 *   npm run user:create
 *
 * Replaces a script line that carried a hardcoded, now-published password. Runs `medusa user` through with-env.mjs
 * (same database guard). Arguments are passed without a shell and nothing here prints the password.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { parse as parseEnv } from "dotenv"

import { requireAdminCredentials } from "./lib/admin-credentials.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = resolve(root, ".env")
// Read the two variables from medusa-backend/.env when the shell does not set them (with-env loads the rest).
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath)) : {}
const { email, password } = requireAdminCredentials("user:create", {
  MEDUSA_ADMIN_EMAIL: process.env.MEDUSA_ADMIN_EMAIL ?? fileEnv.MEDUSA_ADMIN_EMAIL,
  MEDUSA_ADMIN_PASSWORD: process.env.MEDUSA_ADMIN_PASSWORD ?? fileEnv.MEDUSA_ADMIN_PASSWORD,
})

const result = spawnSync(
  process.execPath,
  [resolve(root, "scripts/with-env.mjs"), "user", "-e", email, "-p", password],
  { cwd: root, stdio: "inherit", env: process.env, shell: false }
)
process.exit(result.status ?? 1)
