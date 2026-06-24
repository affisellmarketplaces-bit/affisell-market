"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComputedActionsForShippingMethods = getComputedActionsForShippingMethods;
exports.applyPromotionToShippingMethods = applyPromotionToShippingMethods;
const utils_1 = require("@medusajs/framework/utils");
const validations_1 = require("../validations");
const sort_by_price_1 = require("./sort-by-price");
const usage_1 = require("./usage");
function getComputedActionsForShippingMethods(promotion, shippingMethodApplicationContext, methodIdPromoValueMap) {
    let applicableShippingItems = [];
    if (!shippingMethodApplicationContext) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `"shipping_methods" should be present as an array in the context for computeActions`);
    }
    for (const shippingMethodContext of shippingMethodApplicationContext) {
        const isPromotionApplicableToItem = (0, validations_1.areRulesValidForContext)(promotion.application_method?.target_rules, shippingMethodContext, utils_1.ApplicationMethodTargetType.SHIPPING_METHODS);
        if (!isPromotionApplicableToItem) {
            continue;
        }
        applicableShippingItems.push(shippingMethodContext);
    }
    const allocation = promotion.application_method?.allocation;
    if (allocation === utils_1.ApplicationMethodAllocation.ONCE) {
        applicableShippingItems = applicableShippingItems.sort(sort_by_price_1.sortShippingLineByPriceAscending);
    }
    return applyPromotionToShippingMethods(promotion, applicableShippingItems, methodIdPromoValueMap);
}
function applyPromotionToShippingMethods(promotion, shippingMethods, methodIdPromoValueMap) {
    const { application_method: applicationMethod } = promotion;
    const allocation = applicationMethod?.allocation;
    const computedActions = [];
    const maxQuantity = applicationMethod?.max_quantity ?? 0;
    let remainingQuota = maxQuantity;
    if (allocation === utils_1.ApplicationMethodAllocation.EACH ||
        allocation === utils_1.ApplicationMethodAllocation.ONCE) {
        for (const method of shippingMethods) {
            if (allocation === utils_1.ApplicationMethodAllocation.ONCE &&
                remainingQuota <= 0) {
                break;
            }
            if (!method.subtotal) {
                continue;
            }
            const appliedPromoValue = methodIdPromoValueMap.get(method.id) ?? 0;
            let promotionValue = utils_1.MathBN.convert(applicationMethod?.value ?? 0);
            const applicableTotal = utils_1.MathBN.sub(method.subtotal, appliedPromoValue);
            if (applicationMethod?.type === utils_1.ApplicationMethodType.PERCENTAGE) {
                promotionValue = utils_1.MathBN.mult(utils_1.MathBN.div(promotionValue, 100), applicableTotal);
            }
            const amount = utils_1.MathBN.min(promotionValue, applicableTotal);
            if (utils_1.MathBN.lte(amount, 0)) {
                continue;
            }
            const budgetExceededAction = (0, usage_1.computeActionForBudgetExceeded)(promotion, amount);
            if (budgetExceededAction) {
                computedActions.push(budgetExceededAction);
                continue;
            }
            methodIdPromoValueMap.set(method.id, utils_1.MathBN.add(appliedPromoValue, amount));
            if (allocation === utils_1.ApplicationMethodAllocation.ONCE) {
                remainingQuota -= 1;
            }
            computedActions.push({
                action: utils_1.ComputedActions.ADD_SHIPPING_METHOD_ADJUSTMENT,
                shipping_method_id: method.id,
                amount,
                code: promotion.code,
            });
        }
    }
    if (allocation === utils_1.ApplicationMethodAllocation.ACROSS) {
        const totalApplicableValue = shippingMethods.reduce((acc, method) => {
            const appliedPromoValue = methodIdPromoValueMap.get(method.id) ?? 0;
            return utils_1.MathBN.add(acc, utils_1.MathBN.sub(method.subtotal ?? 0, appliedPromoValue));
        }, utils_1.MathBN.convert(0));
        if (utils_1.MathBN.lte(totalApplicableValue, 0)) {
            return computedActions;
        }
        for (const method of shippingMethods) {
            if (!method.subtotal) {
                continue;
            }
            const promotionValue = applicationMethod?.value ?? 0;
            const appliedPromoValue = methodIdPromoValueMap.get(method.id) ?? 0;
            const applicableTotal = utils_1.MathBN.sub(method.subtotal, appliedPromoValue);
            let applicablePromotionValue = utils_1.MathBN.mult(utils_1.MathBN.div(applicableTotal, totalApplicableValue), promotionValue);
            if (applicationMethod?.type === utils_1.ApplicationMethodType.PERCENTAGE) {
                applicablePromotionValue = utils_1.MathBN.mult(utils_1.MathBN.div(promotionValue, 100), applicableTotal);
            }
            const amount = utils_1.MathBN.min(applicablePromotionValue, applicableTotal);
            if (utils_1.MathBN.lte(amount, 0)) {
                continue;
            }
            const budgetExceededAction = (0, usage_1.computeActionForBudgetExceeded)(promotion, amount);
            if (budgetExceededAction) {
                computedActions.push(budgetExceededAction);
                continue;
            }
            methodIdPromoValueMap.set(method.id, utils_1.MathBN.add(appliedPromoValue, amount));
            computedActions.push({
                action: utils_1.ComputedActions.ADD_SHIPPING_METHOD_ADJUSTMENT,
                shipping_method_id: method.id,
                amount,
                code: promotion.code,
            });
        }
    }
    return computedActions;
}
//# sourceMappingURL=shipping-methods.js.map