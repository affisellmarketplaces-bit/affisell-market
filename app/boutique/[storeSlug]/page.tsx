export default async function StorePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>
}) {
  const { storeSlug } = await params
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-violet-50">
      <header className="border-b bg-white/80 backdrop-blur-xl p-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold">{storeSlug}</h1>
          <div className="h-10 w-10 rounded-full bg-violet-100" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-8">
        <div className="rounded-2xl border border-violet-200/50 bg-white/80 p-12 text-center shadow-lg backdrop-blur-xl">
          <h2 className="mb-4 text-3xl font-bold">Boutique {storeSlug}</h2>
          <p className="text-gray-600">Boutique reseller pro - 1 produit - Coming Soon</p>
          <div className="mt-8 rounded-xl bg-violet-50 p-6">Produit ici</div>
        </div>
      </main>
      <footer className="p-8 text-center text-sm text-gray-400">Powered by Affisell</footer>
    </div>
  )
}
