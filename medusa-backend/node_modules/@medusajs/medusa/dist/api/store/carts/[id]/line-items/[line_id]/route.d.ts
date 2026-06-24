import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: MedusaRequest<HttpTypes.StoreUpdateCartLineItem & AdditionalData, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.StoreCartResponse>) => Promise<void>;
export declare const DELETE: (req: MedusaRequest<{}, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.StoreLineItemDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map