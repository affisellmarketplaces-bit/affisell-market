#!/usr/bin/env node
/** Merge supplier i18n keys from en.json into other locale bundles (parity). */
import fs from "node:fs"
import path from "node:path"

const root = path.join(process.cwd(), "messages")
const en = JSON.parse(fs.readFileSync(path.join(root, "en.json"), "utf8"))
const supplierEn = en.supplier

for (const locale of ["es", "it", "nl", "pl", "zh"]) {
  const filePath = path.join(root, `${locale}.json`)
  const bundle = JSON.parse(fs.readFileSync(filePath, "utf8"))
  bundle.supplier = { ...bundle.supplier, ...supplierEn }
  fs.writeFileSync(filePath, `${JSON.stringify(bundle, null, 2)}\n`)
  console.log(`[merge-supplier-i18n] ${locale}: merged supplier namespace from en`)
}
