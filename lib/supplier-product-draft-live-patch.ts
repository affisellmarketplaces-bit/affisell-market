/** Draft/live flags for supplier PUT — never downgrade a product that is already live. */
export function resolveSupplierProductDraftLivePatch(args: {
  publish: boolean
  saveAsDraft: boolean
  currentIsDraft: boolean
}): { active: boolean; isDraft: boolean } | Record<string, never> {
  if (args.publish) {
    return { active: true, isDraft: false }
  }
  if (args.saveAsDraft && args.currentIsDraft) {
    return { active: false, isDraft: true }
  }
  return {}
}
