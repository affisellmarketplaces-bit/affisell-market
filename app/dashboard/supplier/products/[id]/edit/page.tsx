import { redirect } from "next/navigation"

export default async function SupplierProductEditPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  // Pour un brouillon comme pour un produit publié, /new?edit=ID sait charger
  // Si c'est un brouillon, on passe aussi ?draft=ID pour être sûr
  redirect(`/dashboard/supplier/products/new?edit=${id}&draft=${id}&compose=1`)
}
