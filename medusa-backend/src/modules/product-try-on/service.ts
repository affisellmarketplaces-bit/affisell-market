import { MedusaService } from "@medusajs/framework/utils"

import ProductTryOn from "./models/product-try-on"

class ProductTryOnModuleService extends MedusaService({
  ProductTryOn,
}) {}

export default ProductTryOnModuleService
