"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePromotionRuleAttributes = validatePromotionRuleAttributes;
exports.areRulesValidForContext = areRulesValidForContext;
exports.evaluateRuleValueCondition = evaluateRuleValueCondition;
const utils_1 = require("@medusajs/framework/utils");
function validatePromotionRuleAttributes(promotionRulesData) {
    const errors = [];
    for (const promotionRuleData of promotionRulesData) {
        if (!(0, utils_1.isPresent)(promotionRuleData.attribute)) {
            errors.push("rules[].attribute is a required field");
        }
        if (!(0, utils_1.isPresent)(promotionRuleData.operator)) {
            errors.push("rules[].operator is a required field");
        }
        if ((0, utils_1.isPresent)(promotionRuleData.operator)) {
            const allowedOperators = Object.values(utils_1.PromotionRuleOperator);
            if (!allowedOperators.includes(promotionRuleData.operator)) {
                errors.push(`rules[].operator (${promotionRuleData.operator}) is invalid. It should be one of ${allowedOperators.join(", ")}`);
            }
        }
        else {
            errors.push("rules[].operator is a required field");
        }
    }
    if (!errors.length)
        return;
    throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, errors.join(", "));
}
function areRulesValidForContext(rules, context, contextScope) {
    if (!rules?.length) {
        return true;
    }
    const isItemScope = contextScope === utils_1.ApplicationMethodTargetType.ITEMS;
    const isShippingScope = contextScope === utils_1.ApplicationMethodTargetType.SHIPPING_METHODS;
    return ("initialized" in rules ? [...rules] : rules).every((rule) => {
        if (!rule.attribute || !rule.values?.length) {
            return false;
        }
        const validRuleValues = [];
        for (const value of rule.values) {
            if ((0, utils_1.isString)(value.value)) {
                validRuleValues.push(value.value);
            }
        }
        if (!validRuleValues.length) {
            return false;
        }
        let ruleAttribute = rule.attribute;
        if (isItemScope) {
            ruleAttribute = ruleAttribute.replace(`${utils_1.ApplicationMethodTargetType.ITEMS}.`, "");
        }
        else if (isShippingScope) {
            ruleAttribute = ruleAttribute.replace(`${utils_1.ApplicationMethodTargetType.SHIPPING_METHODS}.`, "");
        }
        const valuesToCheck = (0, utils_1.pickValueFromObject)(ruleAttribute, context);
        return evaluateRuleValueCondition(validRuleValues, rule.operator, valuesToCheck);
    });
}
/*
  Optimized evaluateRuleValueCondition by using early returns and cleaner approach
  for evaluating rule conditions.
*/
function evaluateRuleValueCondition(ruleValues, operator, ruleValuesToCheck) {
    const valuesToCheck = Array.isArray(ruleValuesToCheck)
        ? ruleValuesToCheck
        : [ruleValuesToCheck];
    if (!valuesToCheck.length) {
        switch (operator) {
            case "ne":
                return true;
            default:
                return false;
        }
    }
    switch (operator) {
        case "eq": {
            const ruleValueSet = new Set(ruleValues);
            return valuesToCheck.every((val) => ruleValueSet.has(`${val}`));
        }
        case "in": {
            const ruleValueSet = new Set(ruleValues);
            return valuesToCheck.some((val) => ruleValueSet.has(`${val}`));
        }
        case "ne": {
            const ruleValueSet = new Set(ruleValues);
            return valuesToCheck.every((val) => !ruleValueSet.has(`${val}`));
        }
        case "gt":
            return valuesToCheck.every((val) => ruleValues.some((ruleVal) => utils_1.MathBN.gt(val, ruleVal)));
        case "gte":
            return valuesToCheck.every((val) => ruleValues.some((ruleVal) => utils_1.MathBN.gte(val, ruleVal)));
        case "lt":
            return valuesToCheck.every((val) => ruleValues.some((ruleVal) => utils_1.MathBN.lt(val, ruleVal)));
        case "lte":
            return valuesToCheck.every((val) => ruleValues.some((ruleVal) => utils_1.MathBN.lte(val, ruleVal)));
        default:
            return false;
    }
}
//# sourceMappingURL=promotion-rule.js.map