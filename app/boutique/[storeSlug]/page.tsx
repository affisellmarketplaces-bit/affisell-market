import { prisma } from "@/lib/prisma"
import Link from "next/link"
export default async function StorePage({ params, searchParams }: { params: { storeSlug: string }, searchParams: { productId?: string } }) {
  const { storeSlug } = params
  const product = searchParams.productId? await prisma.marketplaceListing.findUnique({ where: { id: searchParams.productId }, include: { images: true } }) : null
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-violet-50">
      <header className="border-b bg-white/80 backdrop-blur-xl p-4 sticky top-0 z-10"><div className="max-w-6xl mx-auto flex justify-between items-center"><h1 className="text-xl font-bold capitalize">{storeSlug.replace(/-/g,' ')}</h1><Link href="/" className="text-sm text-gray-500">Powered by Affisell</Link></div></header>
      <main className="max-w-6xl mx-auto p-8">
        {!product? <div className="rounded-2xl border bg-white p-12 text-center shadow"><h2 className="text-2xl font-bold">Boutique {storeSlug}</h2><p className="text-gray-500 mt-2">Ajoute?productId=ID à l'URL</p></div> : (
          <div className="grid md:grid-cols-2 gap-8"><div className="rounded-2xl overflow-hidden bg-white shadow-lg"><img src={product.images[0]?.url || '/placeholder.png'} alt={product.title} className="w-full aspect-square object-cover" /></div><div className="rounded-2xl border bg-white p-8 shadow-lg"><h2 className="text-3xl font-bold">{product.title}</h2><p className="text-3xl font-bold text-violet-600 mt-4">{Number(product.price).toFixed(2)} €</p><p className="text-gray-600 mt-4 whitespace-pre-wrap">{product.description?.slice(0,400)}</p><button className="mt-8 w-full h-14 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-lg shadow">Acheter maintenant</button></div></div>
        )}
      </main>
    </div>
  )
}
