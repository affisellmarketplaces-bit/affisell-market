/**
 * Vitest setup — a test process must not see the developer's secrets, exactly like CI (which runs the suite with no env at all).
 *
 * Why this exists: importing `@prisma/client` loads the repository's `.env` into `process.env` for every variable that is still
 * undefined (`vitest.config.ts` isolates *Vite's* env loading, not Prisma's). On a developer machine `.env` holds the PRODUCTION
 * DATABASE_URL and the token ENCRYPTION_KEY, so tests that never meant to touch a database did: for instance
 * lib/__tests__/aliexpress-oauth-token-exchange.test.ts exchanged a fake authorization code and the code under test really
 * saved the fake tokens (`…_iop`) into `PlatformOAuthCredential` of the production database (measured: result 'saved', sockets
 * ESTABLISHED to Neon).
 *
 *   1. Every key of the files Prisma loads is pre-defined as an EMPTY string: dotenv never overrides a defined variable, so
 *      nothing from `.env` can reach a test, whatever it imports and whenever it imports it.
 *   2. Unless RUN_DB_TESTS=1 (the explicit opt-in, which points at the dedicated test database through
 *      lib/testing/db-test-guard.ts), every database / cache credential is emptied too, wherever it came from (shell, CI).
 *      Code treats an empty DATABASE_URL as "no database" — which is how CI runs it.
 *
 * A test that needs a value sets it itself (vi.stubEnv).
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { parse } from "dotenv"

import { collectDatastoreKeys } from "../scripts/build-isolated.mjs"

const root = process.cwd()
const fileEnvs: Record<string, string>[] = []
for (const file of [".env", "prisma/.env"]) {
  const path = resolve(root, file)
  if (existsSync(path)) fileEnvs.push(parse(readFileSync(path)))
}

for (const env of fileEnvs) {
  for (const key of Object.keys(env)) {
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) process.env[key] = ""
  }
}

if (process.env.RUN_DB_TESTS !== "1") {
  for (const key of collectDatastoreKeys(process.env, fileEnvs)) process.env[key] = ""
}
