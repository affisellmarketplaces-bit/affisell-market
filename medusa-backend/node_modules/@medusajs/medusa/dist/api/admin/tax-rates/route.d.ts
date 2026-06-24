import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateTaxRate, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminTaxRateResponse>) => Promise<void>;
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminTaxRateListParams>, res: MedusaResponse<HttpTypes.AdminTaxRateListResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map