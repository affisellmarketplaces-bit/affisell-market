import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUserParams>, res: MedusaResponse<HttpTypes.AdminUserResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateUser, HttpTypes.AdminUserParams>, res: MedusaResponse<HttpTypes.AdminUserResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminUserDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map