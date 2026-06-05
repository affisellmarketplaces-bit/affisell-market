/** Accents glass par colonne footer — famille indigo cohérente. */
export const FOOTER_SECTION_ACCENTS: Record<string, string> = {
  buy: "from-sky-400/90 to-cyan-500/90",
  sell: "from-violet-400/90 to-indigo-500/90",
  company: "from-fuchsia-400/90 to-pink-500/90",
  help: "from-emerald-400/90 to-teal-500/90",
}

export function footerSectionAccent(sectionId: string): string {
  return FOOTER_SECTION_ACCENTS[sectionId] ?? "from-violet-400/90 to-indigo-500/90"
}
