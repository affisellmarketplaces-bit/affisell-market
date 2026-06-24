import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes, PaginatedResponse, RefundReasonResponse, RefundReasonsResponse } from "@medusajs/framework/types";
export declare const GET: (req: AuthenticatedMedusaRequest<HttpTypes.RefundReasonFilters>, res: MedusaResponse<PaginatedResponse<RefundReasonsResponse>>) => Promise<void>;
export declare const POST: (req: AuthenticatedMedusaRequest<HttpTypes.AdminCreateRefundReason, HttpTypes.AdminRefundReasonParams>, res: MedusaResponse<RefundReasonResponse>) => Promise<void>;
//# sourceMappingURL=route.d.ts.map