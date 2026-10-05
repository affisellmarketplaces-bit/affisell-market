/**
 * Query parameters that carry a secret and have no business in an address bar. A password in a URL ends up in browser
 * history, autocomplete, server and CDN logs, analytics and the Referer header sent to third parties.
 *
 * Deliberately NOT here: `token` / `code` — password-reset and magic links legitimately carry those.
 */
const CREDENTIAL_PARAMS = new Set([
  "password",
  "passwd",
  "pwd",
  "pass",
  "confirmpassword",
  "confirm_password",
  "newpassword",
  "new_password",
  "currentpassword",
  "current_password",
])

/**
 * Returns the same URL without its password-like query parameters, or `null` when there was nothing to remove.
 * A form submitted as a plain GET (before the page hydrated, or with scripts blocked) puts every named field there —
 * the proxy redirects such a request to the cleaned URL so the secret does not stay in the address bar.
 */
export function scrubCredentialParams(url: URL): URL | null {
  const doomed = [...url.searchParams.keys()].filter((key) => CREDENTIAL_PARAMS.has(key.toLowerCase()))
  if (doomed.length === 0) return null

  const cleaned = new URL(url.toString())
  for (const key of new Set(doomed)) cleaned.searchParams.delete(key)
  return cleaned
}
