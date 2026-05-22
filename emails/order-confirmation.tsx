import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Hr,
  Link,
} from "@react-email/components"

export interface OrderConfirmationEmailProps {
  orderId: string
  productName: string
  total: number
  currency: string
  customerEmail: string
}

export const OrderConfirmationEmail = ({
  orderId,
  productName,
  total,
  currency,
}: OrderConfirmationEmailProps) => {
  const formattedTotal = (total / 100).toFixed(2)
  const shortOrderId = orderId.slice(-6).toUpperCase()

  return (
    <Html>
      <Head />
      <Preview>Commande Affisell #{shortOrderId} confirmée</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Merci pour votre achat!</Heading>
          <Text style={text}>On a bien reçu votre commande et on la prépare.</Text>

          <Section style={box}>
            <Heading as="h2" style={h2}>
              Récapitulatif
            </Heading>
            <Text style={productNameStyle}>{productName}</Text>
            <Hr style={hr} />
            <Text style={text}>
              <strong>
                Total : {formattedTotal} {currency.toUpperCase()}
              </strong>
            </Text>
            <Text style={text}>
              Numéro de commande : <strong>#{shortOrderId}</strong>
            </Text>
          </Section>

          <Text style={text}>
            Vous recevrez un autre email dès que votre colis est expédié avec le numéro de suivi.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Affisell -{" "}
            <Link href="https://affisell-market.vercel.app">affisell-market.vercel.app</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" }
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
}
const h1 = { color: "#333", fontSize: "24px", fontWeight: "bold", padding: "0 40px" }
const h2 = { color: "#333", fontSize: "20px", fontWeight: "bold" }
const text = { color: "#333", fontSize: "14px", lineHeight: "24px", padding: "0 40px" }
const productNameStyle = {
  color: "#333",
  fontSize: "16px",
  fontWeight: "bold",
  padding: "0 40px",
}
const box = { padding: "0 40px" }
const hr = { borderColor: "#e6ebf1", margin: "20px 40px" }
const footer = { color: "#8898aa", fontSize: "12px", lineHeight: "16px", padding: "0 40px" }

export default OrderConfirmationEmail
