const AUTH_ERROR_KEYS = [
  "supplier_on_affiliate_portal",
  "affiliate_on_supplier_portal",
  "non_affiliate_on_affiliate_portal",
  "non_supplier_on_supplier_portal",
  "non_customer_on_customer_portal",
  "non_agent_on_agent_portal",
  "email_required_not_id",
  "invalid_password",
  "account_not_found",
  "password_login_unavailable",
] as const

type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number]

function isAuthErrorKey(value: string): value is AuthErrorKey {
  return (AUTH_ERROR_KEYS as readonly string[]).includes(value)
}

function parseAuthErrorCandidate(value: string | undefined): AuthErrorKey | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null
  if (isAuthErrorKey(raw)) return raw

  // Some auth flows can return "CredentialsSignin&code=invalid_password".
  const codeParam = /(?:^|[?&])code=([a-z_]+)/i.exec(raw)?.[1]
  if (codeParam && isAuthErrorKey(codeParam)) return codeParam

  // Defensive fallback for opaque strings containing known code.
  const embedded = AUTH_ERROR_KEYS.find((k) => raw.includes(k))
  return embedded ?? null
}

/** Keys under `auth.portal.errors` or top-level `auth.*` for credentials sign-in. */
export function credentialsSignInErrorKey(
  code: string | undefined,
  error: string | undefined
): AuthErrorKey | null {
  const direct = parseAuthErrorCandidate(code)
  if (direct) return direct
  return parseAuthErrorCandidate(error)
}

export function credentialsSignInErrorMessage(
  code: string | undefined,
  errorOrTranslate: string | undefined | ((key: string) => string),
  maybeTranslate?: (key: string) => string
): string | null {
  const translate =
    typeof errorOrTranslate === "function" ? errorOrTranslate : maybeTranslate
  const error = typeof errorOrTranslate === "string" ? errorOrTranslate : undefined
  if (!translate) return null

  const errKey = credentialsSignInErrorKey(code, error)
  if (!errKey) return null
  switch (errKey) {
    case "supplier_on_affiliate_portal":
    case "affiliate_on_supplier_portal":
    case "non_affiliate_on_affiliate_portal":
    case "non_supplier_on_supplier_portal":
    case "non_agent_on_agent_portal":
    case "email_required_not_id":
      return translate(`portal.errors.${errKey}`)
    case "invalid_password":
    case "account_not_found":
    case "password_login_unavailable":
    case "non_customer_on_customer_portal":
      return translate(errKey)
  }
}
