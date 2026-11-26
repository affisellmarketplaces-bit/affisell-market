/**
 * Test-only: a Vite plugin that lets the World Radar seed's TESTS exercise the code that sits behind the disabled-class literals
 * (RSK-90, lot A, decision D10.a).
 *
 * Every class of target is refused by a literal `false` in `scripts/radar-seed-run.ts`, so nothing after the class decision can run
 * through `runRadarSeedCli` as shipped. To test the proofs, the token, the client factory, the probe, the writes and the final states,
 * a test imports the program with a query — `…/scripts/radar-seed-run.ts?lift=staging` (or `production`, `loopback`) — and THIS plugin
 * rewrites, IN MEMORY, the one exact declaration `const <CLASS>_SEED_ENABLED = false` into `true` for that module id only. Nothing is
 * written to disk, the shipped file is never modified, and a different id (no query, or another literal) gets the original text.
 *
 * Why it cannot change what the seed really does:
 *   - it is registered only by `vitest.config.ts`, which only Vitest reads (`tsx`, `npm run radar:seed:*` and the build never load it);
 *   - it acts only on an id that ends in `scripts/radar-seed-run.ts` AND carries the exact query `?lift=<class>`; the bootstrap imports
 *     `./radar-seed-run` with no query (a structural test pins both facts);
 *   - the variant still runs with every effect replaced by a recorder (module doubles, a fake generated client, network spies that
 *     throw): see `lib/__tests__/radar-seed-run.test.ts`.
 * A structural test also pins the shipped literals to `false`, and that only the run test imports with `?lift=`.
 *
 * Typed structurally on purpose: `vite` is not a direct dependency, and `tsc` / the Next build type-check this file.
 */

const CLASSES = ["production", "loopback", "staging"] as const

export function radarLiteralVariant() {
  return {
    name: "radar-literal-variant",
    enforce: "pre" as const,
    transform(code: string, id: string): { code: string; map: null } | null {
      const query = /\?lift=(production|loopback|staging)$/.exec(id)
      if (!query) return null
      if (!/[\\/]scripts[\\/]radar-seed-run\.ts\?lift=/.test(id)) return null
      const literal = `${query[1].toUpperCase()}_SEED_ENABLED`
      const declaration = `const ${literal} = false`
      // Exactly one declaration, or the shipped file changed shape and the variant must fail loudly, not silently pass.
      if (code.split(`\n${declaration}\n`).length !== 2) {
        throw new Error(`radar-literal-variant: expected exactly one \`${declaration}\` line in ${literal}`)
      }
      return { code: code.replace(`\n${declaration}\n`, `\nconst ${literal} = true\n`), map: null }
    },
  }
}

export const RADAR_LITERAL_CLASSES = CLASSES
