import { BigNumberInput, CampaignBudgetExceededAction, CampaignBudgetUsageContext, CampaignBudgetUsageDTO, ComputeActionContext, InferEntityType, PromotionDTO } from "@medusajs/framework/types";
import { Promotion } from "../../models";
/**
 * Compute the action for a budget exceeded.
 * @param promotion - the promotion being applied
 * @param amount - amount can be:
 *  1. discounted amount in case of spend budget
 *  2. number of times the promotion has been used in case of usage budget
 *  3. number of times the promotion has been used by a specific attribute value in case of use_by_attribute budget
 * @param attributeUsage - the attribute usage in case of use_by_attribute budget
 * @returns the exceeded action if the budget is exceeded, otherwise undefined
 */
export declare function computeActionForBudgetExceeded(promotion: PromotionDTO | InferEntityType<typeof Promotion>, amount: BigNumberInput, attributeUsage?: CampaignBudgetUsageDTO): CampaignBudgetExceededAction | void;
export declare function getBudgetUsageContextFromComputeActionContext(computeActionContext: ComputeActionContext): CampaignBudgetUsageContext;
//# sourceMappingURL=usage.d.ts.map