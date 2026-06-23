import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"

import ProductTryOnModule from "../modules/product-try-on"

/** 1:1 Product → Try-On extension (extend Product data model). */
export default defineLink(
  ProductModule.linkable.product,
  ProductTryOnModule.linkable.productTryOn
)
