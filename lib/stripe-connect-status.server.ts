import "server-only"

import type { Prisma } from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { getStripeClient } from "@/lib/stripe"

export type StripeConnectStatusPayload = {
  hasAccount: boolean
  accountId: string | null
  transfersActive: boolean
  onboardedAt: string | null
  bankLast4: string | null
  bankName: string | null
  bankCountry: string | null
  requirementsDue: string[]
  payoutsEnabled: boolean
}

function bankFromExternalAccounts(
  externalAccounts: Stripe.ApiList<Stripe.BankAccount | Stripe.Card> | undefined
): { last4: string | null; bankName: string | null; country: string | null } {
  const bank = externalAccounts?.data?.find((item) => item.object === "bank_account")
  if (!bank || bank.object !== "bank_account") {
    return { last4: null, bankName: null, country: null }
  }
  return {
    last4: bank.last4 ?? null,
    bankName: bank.bank_name ?? null,
    country: bank.country ?? null,
  }
}

export async function loadStripeConnectStatusForUser(
  userId: string
): Promise<StripeConnectStatusPayload> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeAccountId: true,
      stripeOnboardedAt: true,
      stripeCapabilities: true,
    },
  })

  if (!user?.stripeAccountId) {
    return {
      hasAccount: false,
      accountId: null,
      transfersActive: false,
      onboardedAt: null,
      bankLast4: null,
      bankName: null,
      bankCountry: null,
      requirementsDue: [],
      payoutsEnabled: false,
    }
  }

  const stripe = getStripeClient()
  const account = await stripe.accounts.retrieve(user.stripeAccountId, {
    expand: ["external_accounts"],
  })

  const transfersActive = account.capabilities?.transfers === "active"
  const capabilities = (account.capabilities ?? undefined) as Prisma.InputJsonValue | undefined
  let onboardedAt = user.stripeOnboardedAt

  if (transfersActive && !user.stripeOnboardedAt) {
    onboardedAt = new Date()
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeOnboardedAt: onboardedAt,
        stripeCapabilities: capabilities,
      },
    })
  } else if (!transfersActive && user.stripeOnboardedAt) {
    onboardedAt = null
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeOnboardedAt: null,
        stripeCapabilities: capabilities,
      },
    })
  } else if (capabilities) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCapabilities: capabilities },
    })
  }

  const bank = bankFromExternalAccounts(account.external_accounts)
  const requirementsDue = account.requirements?.currently_due ?? []

  return {
    hasAccount: true,
    accountId: user.stripeAccountId,
    transfersActive,
    onboardedAt: onboardedAt?.toISOString() ?? null,
    bankLast4: bank.last4,
    bankName: bank.bankName,
    bankCountry: bank.country,
    requirementsDue,
    payoutsEnabled: transfersActive && requirementsDue.length === 0,
  }
}
