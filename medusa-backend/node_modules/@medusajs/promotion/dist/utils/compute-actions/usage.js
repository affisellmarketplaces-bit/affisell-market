"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeActionForBudgetExceeded = computeActionForBudgetExceeded;
exports.getBudgetUsageContextFromComputeActionContext = getBudgetUsageContextFromComputeActionContext;
const utils_1 = require("@medusajs/framework/utils");
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
function computeActionForBudgetExceeded(promotion, amount, attributeUsage) {
    const campaignBudget = promotion.campaign?.budget;
    if (!campaignBudget) {
        return;
    }
    if (campaignBudget.type === utils_1.CampaignBudgetType.USE_BY_ATTRIBUTE &&
        !attributeUsage) {
        return;
    }
    const campaignBudgetUsed = attributeUsage
        ? attributeUsage.used
        : campaignBudget.used ?? 0;
    const totalUsed = campaignBudget.type === utils_1.CampaignBudgetType.SPEND
        ? utils_1.MathBN.add(campaignBudgetUsed, amount)
        : utils_1.MathBN.add(campaignBudgetUsed, 1);
    if (campaignBudget.limit && utils_1.MathBN.gt(totalUsed, campaignBudget.limit)) {
        return {
            action: utils_1.ComputedActions.CAMPAIGN_BUDGET_EXCEEDED,
            code: promotion.code,
        };
    }
}
function getBudgetUsageContextFromComputeActionContext(computeActionContext) {
    return {
        customer_id: computeActionContext.customer_id ??
            computeActionContext.customer?.id ??
            null,
        customer_email: computeActionContext.email ?? null,
    };
}
//# sourceMappingURL=usage.js.map