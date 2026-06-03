export type FooterNavItem = {
  href: string
  label: string
}

export type FooterNavSection = {
  id: string
  title: string
  links: FooterNavItem[]
}

export type FooterGlobalContent = {
  siteTitle: string
  tagline: string
  sections: FooterNavSection[]
  quickLinks: FooterNavItem[]
  paymentTitle: string
  vatNotice: string
  stripeNotice: string
  stripeNoticeShort: string
  copyrightLine: string
  odrLink: string
  odrHref: string
}
