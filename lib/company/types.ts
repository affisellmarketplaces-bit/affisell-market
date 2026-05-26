export const BLOG_POST_SLUGS = [
  "swipe-feed-affiliate-hub",
  "commission-transparency",
  "gdpr-marketplace-trust",
  "creator-storefront-60s",
] as const

export type BlogPostSlug = (typeof BLOG_POST_SLUGS)[number]

export const CAREER_SLUGS = [
  "fullstack-engineer",
  "creator-success",
  "supplier-partnerships",
] as const

export type CareerSlug = (typeof CAREER_SLUGS)[number]

export function isBlogPostSlug(slug: string): slug is BlogPostSlug {
  return (BLOG_POST_SLUGS as readonly string[]).includes(slug)
}
