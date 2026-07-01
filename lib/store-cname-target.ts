/** CNAME target shown in Store profile (default cname.affisell.com). */
export function getStoreCnameTarget(): string {
  const raw = process.env.STORE_CNAME_TARGET?.trim()
  return raw || "cname.affisell.com"
}
