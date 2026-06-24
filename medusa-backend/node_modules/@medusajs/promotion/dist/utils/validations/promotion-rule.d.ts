import { ApplicationMethodTargetTypeValues, InferEntityType, PromotionRuleDTO } from "@medusajs/framework/types";
import { PromotionRule } from "../../models";
import { CreatePromotionRuleDTO } from "../../types";
export declare function validatePromotionRuleAttributes(promotionRulesData: CreatePromotionRuleDTO[]): void;
export declare function areRulesValidForContext(rules: PromotionRuleDTO[] | InferEntityType<typeof PromotionRule>[], context: Record<string, any>, contextScope: ApplicationMethodTargetTypeValues): boolean;
export declare function evaluateRuleValueCondition(ruleValues: string[], operator: string, ruleValuesToCheck: (string | number)[] | (string | number)): boolean;
//# sourceMappingURL=promotion-rule.d.ts.map