import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateInventoryItem, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminInventoryItemResponse>) => Promise<void>;
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminInventoryItemsParams>, res: MedusaResponse<HttpTypes.AdminInventoryItemListResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map