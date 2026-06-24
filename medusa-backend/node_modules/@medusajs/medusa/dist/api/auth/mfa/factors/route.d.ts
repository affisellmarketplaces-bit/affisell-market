import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { AuthMfaCreateFactorRequestType } from "../../validators";
export declare const GET: (req: AuthenticatedMedusaRequest, res: MedusaResponse) => Promise<MedusaResponse>;
export declare const POST: (req: AuthenticatedMedusaRequest<AuthMfaCreateFactorRequestType>, res: MedusaResponse) => Promise<MedusaResponse>;
//# sourceMappingURL=route.d.ts.map