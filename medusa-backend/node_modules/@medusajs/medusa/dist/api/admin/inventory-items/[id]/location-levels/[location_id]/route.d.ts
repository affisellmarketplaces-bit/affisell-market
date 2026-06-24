import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const DELETE: (req: MedusaRequest<{}, HttpTypes.AdminGetInventoryLocationLevelParams>, res: MedusaResponse<HttpTypes.AdminInventoryLevelDeleteResponse>) => Promise<void>;
export declare const POST: (req: MedusaRequest<HttpTypes.AdminUpdateInventoryLevel, HttpTypes.AdminGetInventoryLocationLevelParams>, res: MedusaResponse<HttpTypes.AdminInventoryItemResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map