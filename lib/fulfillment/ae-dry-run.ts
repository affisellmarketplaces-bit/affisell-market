/** When true, auto-buy runs through prep then skips payment / AE order commit. */
export function isAeDryRun(): boolean {
  return process.env.AE_DRY_RUN === "true"
}
