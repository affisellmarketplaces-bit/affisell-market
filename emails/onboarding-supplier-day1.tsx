import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components"

export type OnboardingSupplierDay1EmailProps = {
  name: string
  importUrl: string
  templateUrl: string
  affiliatePreviewUrl?: string
}

export function OnboardingSupplierDay1Email({
  name,
  importUrl,
  templateUrl,
  affiliatePreviewUrl,
}: OnboardingSupplierDay1EmailProps) {
  const preview = affiliatePreviewUrl ?? templateUrl
  return (
    <Html>
      <Head />
      <Preview>Ton 1er produit est live — visible par 1000+ affiliés</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={text}>Salut {name},</Text>
          <Text style={text}>
            <strong>Ton 1er produit est live.</strong> Voici comment les affiliés le voient dans le
            catalogue — ils peuvent le lister sur leur vitrine en 1 clic.
          </Text>
          <Text style={text}>Checklist affilié :</Text>
          <Text style={listItem}>1. Ils parcourent le catalogue fournisseur</Text>
          <Text style={listItem}>2. Ils fixent leur marge et publient</Text>
          <Text style={listItem}>3. Tu expédies — payout J+2 après livraison</Text>
          <Button href={preview} style={button}>
            Voir comme un affilié
          </Button>
          <Text style={text}>
            Ajouter d&apos;autres SKU :{" "}
            <Link href={importUrl} style={link}>
              import CSV
            </Link>
            {" · "}
            <Link href={templateUrl} style={link}>
              catalogue
            </Link>
          </Text>
          <Text style={muted}>L&apos;équipe Affisell</Text>
        </Container>
      </Body>
    </Html>
  )
}

OnboardingSupplierDay1Email.PreviewProps = {
  name: "Sam",
  importUrl: "https://affisell.com/dashboard/supplier/bulk-import",
  templateUrl: "https://affisell.com/dashboard/supplier/bulk-import",
} satisfies OnboardingSupplierDay1EmailProps

export default OnboardingSupplierDay1Email

const main = { backgroundColor: "#f4f4f5", fontFamily: "system-ui, sans-serif" }
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "520px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
}
const text = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 12px" }
const listItem = { fontSize: "15px", lineHeight: "24px", color: "#3f3f46", margin: "0 0 8px", paddingLeft: "4px" }
const muted = { fontSize: "13px", lineHeight: "20px", color: "#71717a", margin: "16px 0 0" }
const button = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  margin: "8px 0 4px",
}
const link = { color: "#7c3aed", textDecoration: "underline" }
