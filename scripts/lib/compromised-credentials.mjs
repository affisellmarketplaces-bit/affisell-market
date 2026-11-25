/**
 * SHA-256 of credentials that were written in this PUBLIC repository and must be treated as compromised: never used
 * again, and refused by the CI secret scan if they ever reappear. A hash of an already-published value reveals nothing;
 * the values themselves are not written here.
 *
 * Add an entry whenever a credential is found in the repository or its history (after rotating it).
 */
export const COMPROMISED_CREDENTIALS = [
  {
    sha256: "db485485df2c7c9b328cc313aff593ab4cdf672f5fba133de4abd6245fe8b21f",
    what: "Medusa admin password (medusa-backend/package.json, setup-auto.mjs, validate-tryon-sync.mjs)",
    since: "2026-10-05",
  },
  {
    sha256: "df9a243879862e967837e0ca925c99bdfe1ce860b8353ad70ca3494efc138af0",
    what: "test account password in scripts/verify-affiliate-cga-onboarding.ts (affiliate-test@affisell.com)",
    since: "2026-10-05",
  },
  {
    sha256: "aceb7e07ed37824fde669bb6c97945f5ee06ed72714852786c7197ee9dcc033c",
    what: "test account password in scripts/verify-privacy-gate.ts (privacy-test@affisell.com)",
    since: "2026-10-05",
  },
  {
    sha256: "b3bf9083f823b7bd2ec3fae73d68c15aee1b929f985f595a8a3aab74fd60cd77",
    what: "test account password in scripts/verify-supplier-cgs-onboarding.ts (supplier-test@affisell.com)",
    since: "2026-10-05",
  },
]

export const COMPROMISED_SHA256 = new Set(COMPROMISED_CREDENTIALS.map((c) => c.sha256))
