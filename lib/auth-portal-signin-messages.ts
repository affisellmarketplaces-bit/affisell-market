/** Keys under `auth.portal.errors` or top-level `auth.*` for credentials sign-in. */
export function credentialsSignInErrorKey(code: string | undefined): string | null {
  switch (code) {
    case "supplier_on_affiliate_portal":
    case "affiliate_on_supplier_portal":
    case "non_affiliate_on_affiliate_portal":
    case "non_supplier_on_supplier_portal":
    case "non_customer_on_customer_portal":
    case "email_required_not_id":
    case "invalid_password":
    case "account_not_found":
    case "password_login_unavailable":
      return code
    default:
      return null
  }
}

export function credentialsSignInErrorMessage(
  code: string | undefined,
  translate: (key: string) => string
): string | null {
  const errKey = credentialsSignInErrorKey(code)
  if (!errKey) return null
  if (
    errKey === "invalid_password" ||
    errKey === "account_not_found" ||
    errKey === "password_login_unavailable" ||
    errKey === "non_customer_on_customer_portal"
  ) {
    return translate(errKey)
  }
  return translate(`portal.errors.${errKey}`)
}
