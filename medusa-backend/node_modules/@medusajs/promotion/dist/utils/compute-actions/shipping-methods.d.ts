import { BigNumberInput, InferEntityType, PromotionTypes } from "@medusajs/framework/types";
import { ApplicationMethodTargetType } from "@medusajs/framework/utils";
import { Promotion } from "../../models";
export declare function getComputedActionsForShippingMethods(promotion: PromotionTypes.PromotionDTO | InferEntityType<typeof Promotion>, shippingMethodApplicationContext: PromotionTypes.ComputeActionContext[ApplicationMethodTargetType.SHIPPING_METHODS], methodIdPromoValueMap: Map<string, number>): PromotionTypes.ComputeActions[];
export declare function applyPromotionToShippingMethods(promotion: PromotionTypes.PromotionDTO | InferEntityType<typeof Promotion>, shippingMethods: PromotionTypes.ComputeActionContext[ApplicationMethodTargetType.SHIPPING_METHODS], methodIdPromoValueMap: Map<string, BigNumberInput>): PromotionTypes.ComputeActions[];
//# sourceMappingURL=shipping-methods.d.ts.map