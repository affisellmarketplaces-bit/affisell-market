import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

export type CheckoutCountryGraduatedEmailProps = {
  countryName: string
  shopUrl: string
  locale: "fr" | "en"
  previewOrderContext?: {
    orderId: string
    buyerEmail: string
    productTitle: string | null
    orderStatus: string
    orderedAt: string
  }
}

export function CheckoutCountryGraduatedEmail({
  countryName,
  shopUrl,
  locale,
  previewOrderContext,
}: CheckoutCountryGraduatedEmailProps) {
  const copy =
    locale === "en"
      ? {
          preview: `${countryName} is now a permanent Affisell checkout country`,
          heading: `Checkout is permanent in ${countryName}`,
          body: "Good news — Affisell checkout to your country is now part of our permanent marketplace. Browse the catalog and order with secure Stripe payment and local shipping.",
          cta: "Shop now",
          footer: "You are receiving this because you shopped or signed up from this region.",
          previewLabel: "Admin preview · sample buyer context",
          previewOrder: "Order",
          previewProduct: "Product",
          previewBuyer: "Buyer",
          previewStatus: "Status",
        }
      : {
          preview: `${countryName} est désormais un pays checkout permanent sur Affisell`,
          heading: `Checkout permanent en ${countryName}`,
          body: "Bonne nouvelle — le checkout Affisell vers votre pays fait maintenant partie de notre marketplace permanente. Parcourez le catalogue et commandez avec paiement Stripe sécurisé et livraison locale.",
          cta: "Acheter maintenant",
          footer: "Vous recevez cet email car vous avez acheté ou vous êtes inscrit depuis cette région.",
          previewLabel: "Aperçu admin · contexte acheteur exemple",
          previewOrder: "Commande",
          previewProduct: "Produit",
          previewBuyer: "Acheteur",
          previewStatus: "Statut",
        }

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={badge}>🌍 Affisell</Text>
          {previewOrderContext ? (
            <Section style={previewBox}>
              <Text style={previewLabel}>{copy.previewLabel}</Text>
              <Text style={previewLine}>
                {copy.previewOrder}: {previewOrderContext.orderId.slice(0, 12)}… · {copy.previewStatus}:{" "}
                {previewOrderContext.orderStatus}
              </Text>
              {previewOrderContext.productTitle ? (
                <Text style={previewLine}>
                  {copy.previewProduct}: {previewOrderContext.productTitle}
                </Text>
              ) : null}
              <Text style={previewLine}>
                {copy.previewBuyer}: {previewOrderContext.buyerEmail}
              </Text>
            </Section>
          ) : null}
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>{copy.body}</Text>
          <Section style={{ textAlign: "center", margin: "28px 0" }}>
            <Button href={shopUrl} style={button}>
              {copy.cta}
            </Button>
          </Section>
          <Text style={footer}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "32px 24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "16px",
}
const badge = { fontSize: "12px", fontWeight: 700, color: "#7c3aed", margin: "0 0 12px" }
const previewBox = {
  margin: "0 0 16px",
  padding: "12px 14px",
  borderRadius: "12px",
  backgroundColor: "#faf5ff",
  border: "1px solid #e9d5ff",
}
const previewLabel = { fontSize: "11px", fontWeight: 700, color: "#6d28d9", margin: "0 0 6px" }
const previewLine = { fontSize: "12px", lineHeight: "18px", color: "#5b21b6", margin: "0 0 4px" }
const h1 = { fontSize: "24px", fontWeight: 700, color: "#18181b", margin: "0 0 16px" }
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 16px" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "999px",
  fontWeight: 600,
  textDecoration: "none",
}
const footer = { fontSize: "12px", color: "#71717a", margin: "24px 0 0" }

export default CheckoutCountryGraduatedEmail

CheckoutCountryGraduatedEmail.PreviewProps = {
  countryName: "Japan",
  shopUrl: "https://affisell.com/shops/browse?shipsTo=jp",
  locale: "fr",
} satisfies CheckoutCountryGraduatedEmailProps
