import CreatorsLocalePage, { generateMetadata as generateCreatorsMetadata } from "@/app/[locale]/creators/page"

export const generateMetadata = generateCreatorsMetadata

/** English creators landing at `/creators` (not under `[locale]`). */
export default function CreatorsPage() {
  return <CreatorsLocalePage params={Promise.resolve({ locale: "en" })} />
}
