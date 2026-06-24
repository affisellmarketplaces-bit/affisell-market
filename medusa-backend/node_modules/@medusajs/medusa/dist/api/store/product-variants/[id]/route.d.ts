import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { HttpTypes } from "@medusajs/framework/types";
import { StoreRequestWithContext } from "../../types";
import { StoreProductVariantParamsType } from "../validators";
type StoreVariantRetrieveRequest = StoreRequestWithContext<HttpTypes.StoreProductVariantParams> & AuthenticatedMedusaRequest<StoreProductVariantParamsType>;
/**
 * @since 2.11.2
 */
export declare const GET: (req: StoreVariantRetrieveRequest, res: MedusaResponse<HttpTypes.StoreProductVariantResponse>) => Promise<void>;
export {};
//# sourceMappingURL=route.d.ts.map