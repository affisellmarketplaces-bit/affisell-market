import { Context, DAL, PromotionTypes } from "@medusajs/framework/types";
/**
 * Builds a query filter for promotion rules based on the context.
 * This is used to prefilter promotions before computing actions.
 * The idea is that we first retrieve from the database the promotions where all rules can be
 * satisfied by the given context. We exclude promotions that have any rule that cannot be satisfied.
 *
 * @param context
 * @returns
 */
export declare function buildPromotionRuleQueryFilterFromContext(context: PromotionTypes.ComputeActionContext, sharedContext: Context): Promise<DAL.FilterQuery<any> | null>;
//# sourceMappingURL=build-promotion-rule-query-filter-from-context.d.ts.map