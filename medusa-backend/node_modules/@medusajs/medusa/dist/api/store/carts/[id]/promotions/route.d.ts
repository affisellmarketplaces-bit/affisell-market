import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: MedusaRequest<HttpTypes.StoreCartAddPromotion, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.StoreCartResponse>) => Promise<void>;
export declare const DELETE: (req: MedusaRequest<HttpTypes.StoreCartRemovePromotion, HttpTypes.SelectParams>, res: MedusaResponse<{
    cart: HttpTypes.StoreCart;
}>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map