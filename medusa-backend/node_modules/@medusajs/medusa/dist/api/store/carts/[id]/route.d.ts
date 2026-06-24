import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const GET: (req: MedusaRequest<HttpTypes.StoreGetCartsCart>, res: MedusaResponse<HttpTypes.StoreCartResponse>) => Promise<void>;
export declare const POST: (req: MedusaRequest<HttpTypes.StoreUpdateCart & AdditionalData, HttpTypes.SelectParams>, res: MedusaResponse<{
    cart: HttpTypes.StoreCart;
}>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map