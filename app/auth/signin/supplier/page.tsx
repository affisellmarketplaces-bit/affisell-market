import { redirect } from "next/navigation"

export default function LegacySupplierSignInPage() {
  redirect("/login/supplier")
}
