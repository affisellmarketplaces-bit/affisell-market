import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminGetApiKeyParams>, res: MedusaResponse<HttpTypes.AdminApiKeyResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateApiKey, HttpTypes.SelectParams>, res: MedusaResponse<HttpTypes.AdminApiKeyResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminApiKeyDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map