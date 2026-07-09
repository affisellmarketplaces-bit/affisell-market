export function getRequiredDocumentSlugs(role: string): string[] {
  const docs = ["customer", "privacy"]
  if (role === "SUPPLIER") docs.push("supplier")
  if (role === "AFFILIATE") docs.push("affiliate")
  return docs
}
