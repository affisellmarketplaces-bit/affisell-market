import { BigNumberInput, ComputeActionItemLine, InferEntityType, PromotionTypes } from "@medusajs/framework/types";
import { Promotion } from "../../models";
export type EligibleItem = {
    item_id: string;
    quantity: BigNumberInput;
};
export declare function getComputedActionsForBuyGet(promotion: PromotionTypes.PromotionDTO | InferEntityType<typeof Promotion>, itemsContext: ComputeActionItemLine[], methodIdPromoValueMap: Map<string, BigNumberInput>, eligibleBuyItemMap: Map<string, EligibleItem[]>, eligibleTargetItemMap: Map<string, EligibleItem[]>): PromotionTypes.ComputeActions[];
export declare function sortByBuyGetType(a: any, b: any): 0 | 1 | -1;
//# sourceMappingURL=buy-get.d.ts.map