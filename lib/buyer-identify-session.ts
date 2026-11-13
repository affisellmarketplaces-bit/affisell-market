import { buyerAccountRequiresSignIn } from "@/lib/buyer-account-ownership.server"
import { establishBuyerCheckoutSession } from "@/lib/buyer-session-establish.server"
import { identifyBuyerForCheckout, type BuyerIdentifyInput } from "@/lib/buyer-identify"
import { safeAuth } from "@/lib/safe-auth"

export type BuyerIdentifySessionResult =
  | {
      ok: true
      userId: string
      email: string
      isNew: boolean
      displayLabel: string
      sessionEstablished: true
      requiresSignIn: false
    }
  /**
   * The account already exists with an owner or history: a typed identifier is not proof, so NO session was
   * opened. Deliberately carries no e-mail and no display label (the stored name must not leak to whoever typed
   * the address); the caller continues as a guest or asks the buyer to sign in.
   */
  | {
      ok: true
      userId: string
      isNew: false
      sessionEstablished: false
      requiresSignIn: true
    }
  | { ok: false; error: string; status: number }

/**
 * Identify buyer + set JWT session in one server hop (checkout fast path).
 *
 * A session is opened for a new or blank account, or for the account this browser is already signed in to.
 * An existing account with an owner or history is never opened from a bare identifier.
 */
export async function identifyAndEstablishBuyerSession(
  input: BuyerIdentifyInput
): Promise<BuyerIdentifySessionResult> {
  const identified = await identifyBuyerForCheckout(input)
  if (!identified.ok) {
    return { ok: false, error: identified.error, status: identified.status }
  }

  if (!identified.isNew) {
    const current = await safeAuth()
    const alreadySignedIn = current?.user?.id === identified.userId
    if (!alreadySignedIn && (await buyerAccountRequiresSignIn(identified.userId))) {
      console.log("[buyer-identify-session]", {
        userId: identified.userId,
        isNew: false,
        channel: input.channel,
        result: "sign_in_required",
      })
      return {
        ok: true,
        userId: identified.userId,
        isNew: false,
        sessionEstablished: false,
        requiresSignIn: true,
      }
    }
  }

  const session = await establishBuyerCheckoutSession({
    userId: identified.userId,
    email: identified.email,
    name: identified.displayLabel,
  })
  if (!session.ok) {
    return { ok: false, error: "Connexion impossible après identification.", status: 500 }
  }

  console.log("[buyer-identify-session]", {
    userId: identified.userId,
    isNew: identified.isNew,
    channel: input.channel,
    result: "session_established",
  })

  return {
    ok: true,
    userId: identified.userId,
    email: identified.email,
    isNew: identified.isNew,
    displayLabel: identified.displayLabel,
    sessionEstablished: true,
    requiresSignIn: false,
  }
}
