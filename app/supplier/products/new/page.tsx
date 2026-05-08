'use client'
import { useRouter } from 'next/navigation'
import { Plus, Upload, Link, RefreshCw, Sparkles } from 'lucide-react'

export default function AddProductsHub() {
  const router = useRouter()
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Ajouter des produits</h1>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border rounded-lg text-sm">Centre multimédia</button>
            <button className="px-4 py-2 bg-white border rounded-lg text-sm">Ajouter une autorisation de marque</button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Référence tes produits avec la méthode de ton choix</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 - Manuel */}
            <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <Plus className="w-5 h-5 mt-0.5 text-teal-600" />
                <div>
                  <h3 className="font-semibold">Ajoute des produits individuels</h3>
                  <p className="text-sm text-gray-600 mt-1">Ajoute des produits en saisissant toi-même les informations.</p>
                </div>
              </div>
              <button 
                onClick={() => router.push('/supplier/products/create')}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                Ajouter un produit
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>

            {/* Card 2 - Import Excel */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <Upload className="w-5 h-5 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Importation groupée</h3>
                  <p className="text-sm text-gray-600 mt-1">Publie plusieurs produits à la fois à l'aide de modèles Excel.</p>
                </div>
              </div>
            </div>

            {/* Card 3 - URL */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <Link className="w-5 h-5 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Ajouter à l'aide d'une URL <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-1">Bêta</span></h3>
                  <p className="text-sm text-gray-600 mt-1">Saisis une URL de produit provenant d'Amazon ou de Shopify pour importer des informations.</p>
                </div>
              </div>
            </div>

            {/* Card 4 - Sync */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <RefreshCw className="w-5 h-5 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Synchronisation avec d'autres plateformes</h3>
                  <p className="text-sm text-gray-600 mt-1">Utilise une application d'intégration pour procéder à une synchronisation avec d'autres plateformes.</p>
                </div>
              </div>
            </div>

            {/* Card 5 - IA */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <Sparkles className="w-5 h-5 mt-0.5" />
                <div>
                  <h3 className="font-semibold">Publier avec l'IA <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-1">Nouveau</span></h3>
                  <p className="text-sm text-gray-600 mt-1">Décris ton produit et importe des images pour permettre à l'IA de générer les détails du produit.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold">Besoin d'idées de produits ?</h2>
        </div>
      </div>
    </div>
  )
}
