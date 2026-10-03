import { Img, Section, Text } from "@react-email/components"

export type EmailBrandProps = {
  name: string
  logoUrl?: string | null
  primaryColor?: string | null
  buttonTextColor?: string | null
}

export const DEFAULT_EMAIL_ACCENT = "#5469d4"

export function emailAccent(brand?: EmailBrandProps): string {
  return brand?.primaryColor || DEFAULT_EMAIL_ACCENT
}

/** Text colour for a filled accent button. */
export function emailOnAccent(brand?: EmailBrandProps): string {
  return brand?.primaryColor ? brand.buttonTextColor || "#ffffff" : "#ffffff"
}

/** Store logo (or the store name as text) at the top of the email. Renders nothing for the platform brand. */
export function EmailBrandHeader({ brand }: { brand?: EmailBrandProps }) {
  if (!brand) return null
  return (
    <Section style={{ padding: "0 40px 8px" }}>
      {brand.logoUrl ? (
        <Img
          src={brand.logoUrl}
          alt={brand.name}
          height="40"
          style={{ maxWidth: "200px", height: "40px", objectFit: "contain", objectPosition: "left" }}
        />
      ) : (
        <Text style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: emailAccent(brand) }}>{brand.name}</Text>
      )}
    </Section>
  )
}
