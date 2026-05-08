'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Send, HelpCircle } from 'lucide-react'

export default function CreateProductPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Ajouter un produit</h1>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-2">
              <Save className="w-4 h-4" /> Enregistrer comme brouillon
            </button>
            <button className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium flex items-center gap-2">
              <Send className="w-4 h-4" /> Soumettre pour examen
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-2">Suggestions</h3>
            <p className="text-sm text-gray-600">Des informations complètes sur ton produit peuvent t'aider à en augmenter la visibilité.</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-3 flex items-center gap-2">Aperçu <HelpCircle className="w-4 h-4 text-gray-400" /></h3>
            <div className="border rounded-lg p-4 text-center text-gray-400 text-sm">
              L'aperçu apparaîtra ici
            </div>
          </div>
        </div>

        {/* Main Form - Empty for now */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Informations de base</h2>
          <p className="text-gray-500">Le formulaire sera ajouté à l'étape suivante.</p>
        </div>
      </div>
    </div>
  )
}
