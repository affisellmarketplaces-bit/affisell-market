/**
 * JWT_SECRET / COOKIE_SECRET sign every admin session and token. They used to fall back to the literal "supersecret":
 * a Medusa started without them (e.g. a fresh deploy) would accept tokens anyone can forge. Now required, random,
 * at least 32 characters (`openssl rand -hex 32`). The message names the variable, never its value.
 */
const WEAK_SECRETS = new Set(["supersecret", "secret", "changeme", "change-me", "password"])
export const MIN_SESSION_SECRET_LENGTH = 32

export function requiredSessionSecret(
  name: "JWT_SECRET" | "COOKIE_SECRET",
  env: Record<string, string | undefined> = process.env
): string {
  const value = env[name]?.trim() ?? ""
  if (!value || WEAK_SECRETS.has(value.toLowerCase()) || value.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `[medusa-config] ${name} must be set to a random value of at least ${MIN_SESSION_SECRET_LENGTH} characters ` +
        "(openssl rand -hex 32) in medusa-backend/.env or the service environment"
    )
  }
  return value
}
