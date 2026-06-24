import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminTaxRegionParams>, res: MedusaResponse<HttpTypes.AdminTaxRegionResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateTaxRegion, HttpTypes.AdminTaxRegionParams>, res: MedusaResponse<HttpTypes.AdminTaxRegionResponse>) => Promise<MedusaResponse<HttpTypes.AdminTaxRegionResponse>>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminTaxRegionDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map