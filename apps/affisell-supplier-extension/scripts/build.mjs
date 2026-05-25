import * as esbuild from "esbuild"
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const dist = join(root, "dist")
const watch = process.argv.includes("--watch")

mkdirSync(dist, { recursive: true })

await import("./gen-icons.mjs")

const shared = {
  bundle: true,
  format: "esm",
  target: "chrome120",
  sourcemap: true,
  logLevel: "info",
}

const ctx = await esbuild.context({
  ...shared,
  entryPoints: {
    background: join(root, "src/background.ts"),
    popup: join(root, "src/popup.ts"),
    content: join(root, "src/content.ts"),
  },
  outdir: dist,
})

if (watch) {
  cpSync(join(root, "public"), dist, { recursive: true })
  const manifest = JSON.parse(readFileSync(join(root, "public/manifest.json"), "utf8"))
  writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2))
  await ctx.watch()
  console.log("Watching extension…")
} else {
  await ctx.rebuild()
  await ctx.dispose()
  cpSync(join(root, "public"), dist, { recursive: true })
  console.log("Built → apps/affisell-supplier-extension/dist")
}
