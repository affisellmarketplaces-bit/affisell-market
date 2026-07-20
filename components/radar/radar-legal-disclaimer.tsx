/** Legal disclaimer — World Radar opportunity signals (not live marketplace sales). */
export function RadarLegalDisclaimer({ className }: { className?: string }) {
  return (
    <div className={`mt-12 border-t border-zinc-200 pt-6 text-center dark:border-zinc-800 ${className ?? ""}`}>
      <p className="mx-auto max-w-3xl text-xs leading-relaxed text-zinc-500 sm:text-sm">
        Données basées sur l&apos;analyse de 600+ signaux: croissance TikTok/Google Trends, volume de
        recherche, concurrence fournisseur. Mise à jour toutes les 6h. Les scores d&apos;arbitrage et
        de saturation sont des indicateurs d&apos;opportunité, pas des garanties de vente.
      </p>
    </div>
  )
}
