/**
 * Signing secrets for HMAC tokens — fail closed outside development.
 *
 * Several helpers used to fall back to a literal ("affisell-dev-…", or an empty key) when no secret was configured. The
 * repository is public, so a deployment missing the variable would sign tokens anyone can forge. The literal is now only
 * used when NODE_ENV is "development" or "test"; anywhere else a missing secret throws, and the caller's request fails
 * instead of accepting forgeable tokens.
 */
export class MissingSigningSecretError extends Error {
  constructor(purpose: string, names: readonly string[]) {
    super(`[app-secret] no signing secret for ${purpose}: set ${names.join(" or ")}`)
    this.name = "MissingSigningSecretError"
  }
}

function devFallbackAllowed(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "development" || env.NODE_ENV === "test"
}

/**
 * First non-empty variable of `names`; in development / test only, `devFallback` when none is set.
 * @throws MissingSigningSecretError when nothing is configured outside development / test
 */
export function signingSecret(
  purpose: string,
  names: readonly string[],
  devFallback: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  for (const name of names) {
    const value = env[name]?.trim()
    if (value) return value
  }
  if (devFallbackAllowed(env)) return devFallback
  throw new MissingSigningSecretError(purpose, names)
}
