import { redirect } from "next/navigation"

export default function SupplierProductEditPage({ params }: { params: { id: string } }) {
  redirect(`/dashboard/supplier/products/new?edit=${params.id}`)
}
