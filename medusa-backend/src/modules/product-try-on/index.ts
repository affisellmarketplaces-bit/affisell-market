import { Module } from "@medusajs/framework/utils"

import ProductTryOnModuleService from "./service"

export const PRODUCT_TRY_ON_MODULE = "productTryOnModule"

export default Module(PRODUCT_TRY_ON_MODULE, {
  service: ProductTryOnModuleService,
})
