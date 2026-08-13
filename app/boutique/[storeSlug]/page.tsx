export default function StorePage({ params }: { params: { storeSlug: string } }) {
  const { storeSlug } = params
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-violet-50">
      <header className="border-b bg-white/80 backdrop-blur-xl p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">{storeSlug}</h1>
          <div className="w-10 h-10 rounded-full bg-violet-100" />
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">
        <div className="rounded-2xl border border-violet-200/50 bg-white/80 backdrop-blur-xl shadow-lg p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Boutique {storeSlug}</h2>
          <p className="text-gray-600">Boutique reseller pro - 1 produit - Coming Soon</p>
          <div className="mt-8 p-6 bg-violet-50 rounded-xl">Produit ici</div>
        </div>
      </main>
      <footer className="text-center p-8 text-sm text-gray-400">Powered by Affisell</footer>
    </div>
  )
}
