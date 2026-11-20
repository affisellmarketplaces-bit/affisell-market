/**
 * One server-side rule for every password Affisell stores (signup, reset). Pure: no I/O.
 *
 * - at least 8 characters (counted as code points, the same as the forms' client-side check);
 * - at most 72 BYTES in UTF-8: bcrypt (the hash used everywhere, `bcryptjs`) silently ignores everything after the 72nd
 *   byte, so a longer password would be accepted while only its first 72 bytes protect the account;
 * - not one of the most common passwords, and not the account's own e-mail address (or its local part).
 *
 * The codes are language-neutral; each route maps them to its own message.
 */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_BYTES = 72

export type PasswordPolicyError =
  | "password_missing"
  | "password_too_short"
  | "password_too_long"
  | "password_too_common"
  | "password_matches_email"

/** Lower-cased. Short on purpose: the most common choices that pass an 8-character rule. */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "motdepasse",
  "motdepasse1",
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "00000000",
  "87654321",
  "azertyuiop",
  "azerty123",
  "qwertyuiop",
  "qwerty123",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "abc12345",
  "abcd1234",
  "letmein1",
  "welcome1",
  "bienvenue",
  "soleil123",
  "affisell",
  "affisell123",
])

export function checkPasswordPolicy(
  password: unknown,
  opts: { email?: string | null } = {}
): { ok: true } | { ok: false; error: PasswordPolicyError } {
  if (typeof password !== "string" || password.length === 0) return { ok: false, error: "password_missing" }
  if ([...password].length < PASSWORD_MIN_LENGTH) return { ok: false, error: "password_too_short" }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return { ok: false, error: "password_too_long" }

  const lowered = password.trim().toLowerCase()
  if (COMMON_PASSWORDS.has(lowered)) return { ok: false, error: "password_too_common" }
  // One repeated character ("aaaaaaaa") is as weak as the list above.
  if (new Set([...lowered]).size === 1) return { ok: false, error: "password_too_common" }

  const email = opts.email?.trim().toLowerCase()
  if (email) {
    const local = email.split("@")[0] ?? ""
    if (lowered === email || (local.length >= 4 && lowered === local)) {
      return { ok: false, error: "password_matches_email" }
    }
  }
  return { ok: true }
}

/** French message for the routes that answer with a sentence (signup). */
export function passwordPolicyMessageFr(error: PasswordPolicyError): string {
  switch (error) {
    case "password_missing":
      return "Le mot de passe est obligatoire."
    case "password_too_short":
      return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`
    case "password_too_long":
      return "Le mot de passe est trop long (72 octets au maximum, soit environ 72 caractères sans accents)."
    case "password_too_common":
      return "Ce mot de passe est trop courant. Choisissez-en un autre."
    case "password_matches_email":
      return "Le mot de passe ne doit pas être votre adresse e-mail."
  }
}
