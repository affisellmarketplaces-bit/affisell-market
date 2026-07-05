import { sendStoreNewsletterWelcomeEmail } from "@/lib/emails/send-store-newsletter-welcome"
import { prisma } from "@/lib/prisma"
import { storePublicUrl } from "@/lib/store-public-url"
import { normalizeStoreNewsletterEmail } from "@/lib/store-newsletter-subscribe.shared"

export type SubscribeStoreNewsletterInput = {
  storeSlug: string
  email: string
  locale?: string | null
  source?: string
}

export type SubscribeStoreNewsletterResult =
  | { ok: true; created: boolean; storeId: string; storeName: string }
  | { ok: false; error: string }

export async function subscribeStoreNewsletter(
  input: SubscribeStoreNewsletterInput
): Promise<SubscribeStoreNewsletterResult> {
  const email = normalizeStoreNewsletterEmail(input.email)
  if (!email) return { ok: false, error: "invalid_email" }

  const slug = input.storeSlug.trim()
  if (!slug) return { ok: false, error: "invalid_store" }

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      customDomain: true,
      domainVerified: true,
      userId: true,
      user: { select: { role: true } },
    },
  })
  if (!store || store.user.role !== "AFFILIATE") {
    return { ok: false, error: "store_not_found" }
  }

  const locale = input.locale?.trim().slice(0, 8) || null
  const source = input.source?.trim().slice(0, 64) || "storefront_newsletter"

  const existing = await prisma.storeNewsletterSubscriber.findUnique({
    where: { storeId_email: { storeId: store.id, email } },
    select: { id: true, welcomeEmailSentAt: true },
  })

  const row = await prisma.storeNewsletterSubscriber.upsert({
    where: { storeId_email: { storeId: store.id, email } },
    create: {
      storeId: store.id,
      email,
      locale,
      source,
    },
    update: {
      locale: locale ?? undefined,
      source,
      updatedAt: new Date(),
    },
    select: { id: true, welcomeEmailSentAt: true },
  })

  const created = !existing
  const shopUrl = storePublicUrl({
    slug: store.slug,
    customDomain: store.customDomain,
    domainVerified: store.domainVerified,
    role: "AFFILIATE",
  })

  if (created) {
    await prisma.notification.create({
      data: {
        userId: store.userId,
        type: "STORE_NEWSLETTER_SUBSCRIBER",
        message: `New newsletter subscriber · ${email} · ${store.name}`,
      },
    })
  }

  const shouldSendWelcome = !row.welcomeEmailSentAt
  if (shouldSendWelcome) {
    void sendStoreNewsletterWelcomeEmail({
      to: email,
      storeName: store.name,
      shopUrl,
      locale,
    })
      .then(async (sent) => {
        if (!sent.ok) return
        await prisma.storeNewsletterSubscriber.update({
          where: { id: row.id },
          data: { welcomeEmailSentAt: new Date() },
        })
      })
      .catch((error) => {
        console.error("[store-newsletter]", {
          storeId: store.id,
          result: "welcome_email_failed",
          error,
        })
      })
  }

  console.log("[store-newsletter]", {
    storeId: store.id,
    storeSlug: store.slug,
    created,
    result: "subscribed",
  })

  return { ok: true, created, storeId: store.id, storeName: store.name }
}
