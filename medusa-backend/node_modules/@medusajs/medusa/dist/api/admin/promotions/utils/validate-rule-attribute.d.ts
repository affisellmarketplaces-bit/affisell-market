import { ApplicationMethodTargetTypeValues, ApplicationMethodTypeValues, PromotionTypeValues, RuleTypeValues } from "@medusajs/types";
export declare function validateRuleAttribute(attributes: {
    promotionType: PromotionTypeValues | undefined;
    ruleType: RuleTypeValues;
    ruleAttributeId: string;
    applicationMethodType?: ApplicationMethodTypeValues;
    applicationMethodTargetType?: ApplicationMethodTargetTypeValues;
}): void;
//# sourceMappingURL=validate-rule-attribute.d.ts.map