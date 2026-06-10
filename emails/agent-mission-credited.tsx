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

export type AgentMissionCreditedEmailProps = {
  agentName: string
  missionTypeLabel: string
  productName: string
  amountEur: string
  balanceEur: string
  dashboardUrl: string
}

export function AgentMissionCreditedEmail({
  agentName,
  missionTypeLabel,
  productName,
  amountEur,
  balanceEur,
  dashboardUrl,
}: AgentMissionCreditedEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>Mission validée — +{amountEur} € crédités</Preview>
      <Body style={{ backgroundColor: "#0f172a", fontFamily: "Inter, sans-serif", padding: "24px" }}>
        <Container style={{ maxWidth: "520px", margin: "0 auto" }}>
          <Section
            style={{
              backgroundColor: "#1e293b",
              borderRadius: "12px",
              padding: "28px",
              border: "1px solid #334155",
            }}
          >
            <Text style={{ color: "#6ee7b7", fontSize: "12px", fontWeight: 600, margin: 0 }}>
              Affisell Agent Network — Paiement
            </Text>
            <Heading style={{ color: "#f8fafc", fontSize: "22px", marginTop: "12px" }}>
              +{amountEur} € crédités
            </Heading>
            <Text style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: "22px" }}>
              Bonjour {agentName}, votre mission a été validée et votre solde a été crédité.
            </Text>
            <Section
              style={{
                backgroundColor: "#0f172a",
                borderRadius: "8px",
                padding: "16px",
                marginTop: "16px",
              }}
            >
              <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Mission</Text>
              <Text style={{ color: "#f1f5f9", fontSize: "15px", margin: "0 0 12px", fontWeight: 600 }}>
                {missionTypeLabel}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Produit</Text>
              <Text style={{ color: "#f1f5f9", fontSize: "15px", margin: "0 0 12px" }}>{productName}</Text>
              <Text style={{ color: "#94a3b8", fontSize: "12px", margin: "0 0 4px" }}>Nouveau solde</Text>
              <Text style={{ color: "#6ee7b7", fontSize: "18px", margin: 0, fontWeight: 700 }}>
                {balanceEur} €
              </Text>
            </Section>
            <Button
              href={dashboardUrl}
              style={{
                backgroundColor: "#10b981",
                color: "#0f172a",
                fontWeight: 600,
                borderRadius: "8px",
                padding: "12px 20px",
                marginTop: "20px",
                fontSize: "14px",
              }}
            >
              Retirer via Stripe Connect
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
