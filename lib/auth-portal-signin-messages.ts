/** Keys under `auth.portal.errors` for credentials portal enforcement. */
export function credentialsSignInErrorKey(code: string | undefined): string | null {
  switch (code) {
    case "supplier_on_affiliate_portal":
    case "affiliate_on_supplier_portal":
    case "non_affiliate_on_affiliate_portal":
    case "non_supplier_on_supplier_portal":
    case "email_required_not_id":
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
  return translate(`portal.errors.${errKey}`)
}
