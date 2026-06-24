import { HttpTypes, MedusaContainer } from "@medusajs/framework/types";
import { StoreRequestWithContext } from "../types";
export type RequestWithContext<Body, QueryFields = Record<string, unknown>> = StoreRequestWithContext<Body, QueryFields>;
export declare const refetchProduct: (idOrFilter: string | object, scope: MedusaContainer, fields: string[]) => Promise<any>;
export declare const filterOutInternalProductCategories: (products: HttpTypes.StoreProduct[]) => void;
export declare const wrapProductsWithTaxPrices: <T>(req: RequestWithContext<T>, products: HttpTypes.StoreProduct[]) => Promise<void>;
//# sourceMappingURL=helpers.d.ts.map