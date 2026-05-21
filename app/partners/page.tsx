import PartnersLocalePage, { generateMetadata as generatePartnersMetadata } from "@/app/[locale]/partners/page"

export const generateMetadata = generatePartnersMetadata

/** English partners landing at `/partners`. */
export default function PartnersPage() {
  return <PartnersLocalePage params={Promise.resolve({ locale: "en" })} />
}
