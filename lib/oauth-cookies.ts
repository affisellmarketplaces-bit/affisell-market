/** HttpOnly cookie: merchant intent before OAuth redirect (consume in Auth createUser event). */
export const OAUTH_SIGNUP_INTENT_COOKIE = "oauth_signup_intent"
/** Supplier invite token to claim after OAuth signup (consume in Auth createUser). */
export const SUPPLIER_INVITE_TOKEN_COOKIE = "affisell_supplier_invite_token"
/** Short-lived toast after successful OAuth login; cleared via dismiss route. */
export const OAUTH_WELCOME_COOKIE = "oauth_welcome"

export const MERCHANT_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
}
