import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
import { StoreRequestWithContext } from "../types";
type StoreVariantListRequest<T = HttpTypes.StoreProductVariantParams> = StoreRequestWithContext<T> & AuthenticatedMedusaRequest<T>;
/**
 * @since 2.11.2
 */
export declare const GET: (req: StoreVariantListRequest, res: MedusaResponse<HttpTypes.StoreProductVariantListResponse>) => Promise<void>;
export {};
//# sourceMappingURL=route.d.ts.map