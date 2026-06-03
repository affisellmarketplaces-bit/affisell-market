import { getTranslations } from "next-intl/server"

import { DemoLabIndex } from "@/components/demo/demo-lab-index"

export async function generateMetadata() {
  const t = await getTranslations("demoLab")
  return {
    title: `${t("title")} | Affisell`,
    description: t("heroSubtitle"),
    robots: { index: true, follow: true },
  }
}

export default function DemoLabPage() {
  return <DemoLabIndex />
}
