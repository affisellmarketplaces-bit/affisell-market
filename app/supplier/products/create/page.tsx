"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { ArrowLeft, Save, Send, HelpCircle, Upload, Sparkles } from "lucide-react"
import { SortableProductImage } from "./sortable-product-image"

export default function CreateProductPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [video, setVideo] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [isCategorizing, setIsCategorizing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isMain = false) => {
    const files = Array.from(e.target.files || [])
    const urls = files.map((f) => URL.createObjectURL(f))
    const newImages = isMain ? [urls[0], ...images] : [...images, ...urls]
    setImages(newImages.slice(0, 9))
    if (isMain || images.length === 0) runAutoCategorize(title, urls[0])
    e.target.value = ""
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = Number(active.id)
    const newIndex = Number(over.id)
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return
    setImages((items) => arrayMove(items, oldIndex, newIndex))
  }

  const runAutoCategorize = async (currentTitle: string, imageUrl?: string) => {
    if (currentTitle.length < 3 && !imageUrl) return
    setIsCategorizing(true)
    setCategorySuggestions([])
    try {
      const res = await fetch("/api/categorize-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: currentTitle, imageUrl: imageUrl || images[0] }),
      })
      const data = await res.json()
      if (data.categories?.length) {
        const suggestions = data.categories.slice(0, 3)
        setCategorySuggestions(suggestions)
        setSelectedCategory(suggestions[0])
      }
    } catch (e) {
      console.error("Categorization failed:", e)
    }
    setIsCategorizing(false)
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runAutoCategorize(title), 800)
    return () => clearTimeout(debounceRef.current)
  }, [title])

  const handleSubmit = async (isDraft: boolean) => {
    if (!title || !selectedCategory || images.length === 0) {
      alert("Remplis: Nom, Catégorie, au moins 1 image")
      return
    }

    const payload = {
      title,
      description,
      category: selectedCategory,
      images,
      video,
      status: isDraft ? "draft" : "pending_review",
    }

    console.log("SUBMIT:", payload)
    alert(isDraft ? "Brouillon enregistré" : "Produit soumis pour examen")
  }

  const sortableIds = images.map((_, i) => String(i))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Ajouter un produit</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Enregistrer comme brouillon
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
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
            <p className="text-sm text-gray-600">
              Des informations complètes sur ton produit peuvent t&apos;aider à en augmenter la visibilité.
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              Aperçu <HelpCircle className="w-4 h-4 text-gray-400" />
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 aspect-square flex items-center justify-center">
                {images[0] ? (
                  <img src={images[0]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="text-center text-gray-400">
                    <Upload className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">Ajouter des images</p>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-medium text-sm truncate">{title || "Nom du produit"}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedCategory || "Catégorie"}</p>
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
              <p className="text-sm text-gray-600 mb-1">
                Nous recommandons d&apos;ajouter au moins 5 images pour bien représenter ton produit.
              </p>
              <p className="text-xs text-gray-500 mb-3">Glisser-déposer les vignettes pour réorganiser l&apos;ordre.</p>

              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition relative z-0">
                  <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, true)} accept="image/*" />
                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-600 text-center px-2">Importer l&apos;image principale</span>
                </label>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
                    <div className="contents">
                      {images.map((src, idx) => (
                        <SortableProductImage
                          key={src}
                          id={String(idx)}
                          src={src}
                          isCover={idx === 0}
                          onRemove={() => removeImage(idx)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {images.length < 9 ? (
                  <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition">
                    <input type="file" className="hidden" multiple onChange={(e) => handleImageUpload(e, false)} accept="image/*" />
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-600 text-center px-2">Ajouter des images</span>
                  </label>
                ) : null}
              </div>
            </div>

            {/* Nom */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                <span className="text-red-500">*</span> Nom du produit <HelpCircle className="w-4 h-4 text-gray-400" />
              </label>
              <div className="relative">
                <input
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-16 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={255}
                  placeholder="Saisis le nom du produit"
                />
                <span className="absolute right-3 top-3 text-sm text-gray-400">{title.length}/255</span>
              </div>
              {isCategorizing && (
                <div className="flex items-center gap-2 mt-2 text-purple-600">
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">L&apos;IA analyse ton produit...</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Description</label>
              <textarea
                className="w-full min-h-[120px] border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décris ton produit (optionnel pour l&apos;instant)"
              />
            </div>

            {/* Vidéo (URL) */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Vidéo (URL)</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                value={video}
                onChange={(e) => setVideo(e.target.value)}
                placeholder="https://…"
              />
            </div>

            {/* Catégorie IA */}
            <div>
              <label className="block text-sm font-semibold mb-2 flex items-center gap-1">
                <span className="text-red-500">*</span> Catégorie <HelpCircle className="w-4 h-4 text-gray-400" />
              </label>
              {categorySuggestions.length > 0 && (
                <div className="flex items-center gap-2 mb-2 text-purple-600">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-medium">{categorySuggestions.length} suggestions</span>
                </div>
              )}
              <select
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-teal-500"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Sélectionner une catégorie</option>
                {categorySuggestions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
