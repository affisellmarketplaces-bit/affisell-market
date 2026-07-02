import { signIn } from "@/auth"
import { createBuyerCheckoutMagicToken } from "@/lib/buyer-checkout-magic"

export type EstablishBuyerSessionResult =
  | { ok: true }
  | { ok: false; error: string }

function isNextAuthRedirectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const digest = (error as Error & { digest?: string }).digest
  return (
    error.message === "NEXT_REDIRECT" ||
    error.message.includes("NEXT_REDIRECT") ||
    digest === "NEXT_REDIRECT"
  )
}

/** Opens a CUSTOMER JWT session from route handlers (no client signIn roundtrip). */
export async function establishBuyerCheckoutSession(args: {
  userId: string
  email: string
  name?: string | null
}): Promise<EstablishBuyerSessionResult> {
  const checkoutMagic = createBuyerCheckoutMagicToken(args.userId, {
    email: args.email,
    name: args.name,
  })

  try {
    const result = await signIn("credentials", { checkoutMagic, redirect: false })
    if (result && typeof result === "object" && "error" in result && result.error) {
      console.error("[buyer-session-establish]", {
        userId: args.userId,
        result: "sign_in_failed",
        error: String(result.error),
      })
      return { ok: false, error: "session_failed" }
    }
    return { ok: true }
  } catch (error) {
    if (isNextAuthRedirectError(error)) return { ok: true }
    console.error("[buyer-session-establish]", {
      userId: args.userId,
      result: "error",
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: "session_failed" }
  }
}
