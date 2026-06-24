import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdminGetStoreParamsType } from "../validators";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<AdminGetStoreParamsType>, res: MedusaResponse<HttpTypes.AdminStoreResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateStore, HttpTypes.AdminStoreParams>, res: MedusaResponse<HttpTypes.AdminStoreResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map