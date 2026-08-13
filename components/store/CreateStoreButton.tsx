"use client"
export function CreateStoreButton({ productId }: { productId: string }) {
  const handleClick = async () => {
    const name = prompt("Nom de ta boutique?")
    if(!name) return
    const res = await fetch("/api/store/create", { method: "POST", body: JSON.stringify({ storeName: name, productId }), headers: { "Content-Type": "application/json" } })
    const data = (await res.json()) as { url?: string }
    if (data.url) window.open(data.url, "_blank", "noopener,noreferrer")
  }
  return <button onClick={handleClick} className="h-12 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium">🚀 Créer ma boutique</button>
}
