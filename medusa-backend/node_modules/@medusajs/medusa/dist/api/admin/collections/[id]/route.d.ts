import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AdditionalData, HttpTypes } from "@medusajs/framework/types";
import { AdminUpdateCollectionType } from "../validators";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCollectionParams>, res: MedusaResponse<HttpTypes.AdminCollectionResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<AdminUpdateCollectionType & AdditionalData, HttpTypes.AdminCollectionParams>, res: MedusaResponse<HttpTypes.AdminCollectionResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminCollectionDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map