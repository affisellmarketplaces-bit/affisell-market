import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateTaxRate, HttpTypes.AdminGetTaxRateParams>, res: MedusaResponse<HttpTypes.AdminTaxRateResponse>) => Promise<void>;
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetTaxRateParams>, res: MedusaResponse<HttpTypes.AdminTaxRateResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminTaxRateDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map