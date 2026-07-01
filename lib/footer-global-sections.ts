import type { FooterSocialId } from "@/lib/footer-social-links"

export type FooterNavItem = {
  href: string
  label: string
}

export type FooterNavSection = {
  id: string
  title: string
  links: FooterNavItem[]
}

export type FooterSocialLink = {
  id: FooterSocialId
  href: string
  label: string
}

export type FooterTrustBeacon = {
  href: string
  title: string
  hint: string
  cta: string
}

export type FooterGlobalContent = {
  siteTitle: string
  tagline: string
  sections: FooterNavSection[]
  quickLinks: FooterNavItem[]
  trustBeacon: FooterTrustBeacon
  legalBar: FooterNavItem[]
  socialLinks: FooterSocialLink[]
  paymentTitle: string
  paymentMethodsAriaLabel: string
  paymentProcessorHint: string
  paymentProcessorSecure: string
  paymentMethodsComplianceNote: string
  vatNotice: string
  stripeNotice: string
  stripeNoticeShort: string
  copyrightLine: string
  odrLink: string
  odrHref: string
  panEuBadge: string
  localeLabel: string
}
