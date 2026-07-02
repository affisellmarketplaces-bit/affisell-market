import { establishBuyerCheckoutSession } from "@/lib/buyer-session-establish.server"
import { identifyBuyerForCheckout, type BuyerIdentifyInput } from "@/lib/buyer-identify"

export type BuyerIdentifySessionResult =
  | {
      ok: true
      userId: string
      email: string
      isNew: boolean
      displayLabel: string
      sessionEstablished: true
    }
  | { ok: false; error: string; status: number }

/** Identify buyer + set JWT session in one server hop (checkout fast path). */
export async function identifyAndEstablishBuyerSession(
  input: BuyerIdentifyInput
): Promise<BuyerIdentifySessionResult> {
  const identified = await identifyBuyerForCheckout(input)
  if (!identified.ok) {
    return { ok: false, error: identified.error, status: identified.status }
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
  }
}
