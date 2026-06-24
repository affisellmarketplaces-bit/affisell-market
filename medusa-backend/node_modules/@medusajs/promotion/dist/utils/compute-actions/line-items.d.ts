import { ApplicationMethodAllocationValues, InferEntityType, PromotionTypes } from "@medusajs/framework/types";
import { ApplicationMethodTargetType as TargetType } from "@medusajs/framework/utils";
import { Promotion } from "../../models";
export declare function getComputedActionsForItems(promotion: PromotionTypes.PromotionDTO | InferEntityType<typeof Promotion>, items: PromotionTypes.ComputeActionContext[TargetType.ITEMS], appliedPromotionsMap: Map<string, number>, allocationOverride?: ApplicationMethodAllocationValues): PromotionTypes.ComputeActions[];
//# sourceMappingURL=line-items.d.ts.map