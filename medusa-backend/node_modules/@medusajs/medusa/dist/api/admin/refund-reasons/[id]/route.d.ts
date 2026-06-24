import { HttpTypes, RefundReasonResponse } from "@medusajs/framework/types";
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.AdminRefundReasonParams>, res: MedusaResponse<RefundReasonResponse>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminUpdateRefundReason, HttpTypes.AdminRefundReasonParams>, res: MedusaResponse<RefundReasonResponse>) => Promise<void>;
export declare const DELETE: (req: AuthenticatedMedusaRequest, res: MedusaResponse<HttpTypes.AdminRefundReasonDeleteResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map