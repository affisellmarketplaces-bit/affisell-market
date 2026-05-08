'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Send, HelpCircle, Upload } from 'lucide-react'

export default function CreateProductPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [images, setImages] = useState<string[]>([])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isMain = false) => {
    const files = Array.from(e.target.files || [])
    const urls = files.map(f => URL.createObjectURL(f))
    const newImages = isMain? [urls[0],...images] : [...images,...urls]
    setImages(newImages.slice(0, 9))
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i!== index))
  }

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
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 aspect-square flex items-center justify-center">
                {images[0]? (
                  <img src={images[0]} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-gray-400">
                    <Upload className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">Ajouter des images</p>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-sm truncate">{title || 'Nom du produit'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Informations de base</h2>
            
            {/* Images */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                <span className="text-red-500">*</span> Images <HelpCircle className="w-4 h-4 text-gray-400" />
              </label>
              <p className="text-sm text-gray-600 mb-3">Nous recommandons d'ajouter au moins 5 images pour bien représenter ton produit.</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition">
                  <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, true)} accept="image/*" />
                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-600 text-center px-2">Importer l'image principale</span>
                </label>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-100 rounded-lg relative group">
                    {images[i+1]? (
                      <>
                        <img src={images[i+1]} className="w-full h-full object-cover rounded-lg" />
                        <button 
                          onClick={() => removeImage(i+1)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs"
                        >×</button>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                <span className="text-red-500">*</span> Nom du produit <HelpCircle className="w-4 h-4 text-gray-400" />
              </label>
              <div className="relative">
                <input 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-16 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={255}
                  placeholder="Saisis le nom du produit"
                />
                <span className="absolute right-3 top-3 text-sm text-gray-400">{title.length}/255</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
