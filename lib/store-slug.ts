/** URL-safe slug: lowercase, hyphens */
export function slugFromStoreName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return s || "store"
}

/** Readable default store title from optional user.name or email local part */
export function defaultStoreNameFromSignup(email: string, userName: string | null | undefined): string {
  const fromUser = userName?.trim()
  if (fromUser) {
    const withStore = /\bstore\b/i.test(fromUser) ? fromUser : `${fromUser} Store`
    return withStore.slice(0, 40)
  }
  const local = (email.split("@")[0] || "seller").trim()
  const words = local
    .replace(/[\._+-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  const titled = words.join(" ").slice(0, 28) || "My"
  const withSuffix = `${titled} Store`
  return withSuffix.slice(0, 40)
}
