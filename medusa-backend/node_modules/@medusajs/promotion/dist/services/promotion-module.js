"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@medusajs/framework/types");
const utils_1 = require("@medusajs/framework/utils");
const _models_1 = require("../models");
const _types_1 = require("../types");
const _utils_1 = require("../utils");
const build_promotion_rule_query_filter_from_context_1 = require("../utils/compute-actions/build-promotion-rule-query-filter-from-context");
class PromotionModuleService extends (0, utils_1.MedusaService)({
    Promotion: _models_1.Promotion,
    ApplicationMethod: _models_1.ApplicationMethod,
    Campaign: _models_1.Campaign,
    CampaignBudget: _models_1.CampaignBudget,
    CampaignBudgetUsage: _models_1.CampaignBudgetUsage,
    PromotionRule: _models_1.PromotionRule,
    PromotionRuleValue: _models_1.PromotionRuleValue,
}) {
    constructor({ baseRepository, promotionService, applicationMethodService, promotionRuleService, promotionRuleValueService, campaignService, campaignBudgetService, campaignBudgetUsageService, }, moduleDeclaration) {
        // @ts-ignore
        super(...arguments);
        this.moduleDeclaration = moduleDeclaration;
        this.baseRepository_ = baseRepository;
        this.promotionService_ = promotionService;
        this.applicationMethodService_ = applicationMethodService;
        this.promotionRuleService_ = promotionRuleService;
        this.promotionRuleValueService_ = promotionRuleValueService;
        this.campaignService_ = campaignService;
        this.campaignBudgetService_ = campaignBudgetService;
        this.campaignBudgetUsageService_ = campaignBudgetUsageService;
    }
    async listActivePromotions(filters, config, sharedContext) {
        const activePromotions = await this.listActivePromotions_(filters, config, sharedContext);
        return this.baseRepository_.serialize(activePromotions);
    }
    async listActivePromotions_(filters, config, sharedContext) {
        // Ensure we share the same now date across all filters
        const now = new Date();
        const activeFilters = {
            status: utils_1.PromotionStatus.ACTIVE,
            $or: [
                {
                    campaign_id: null,
                    ...filters,
                },
                {
                    ...filters,
                    campaign: {
                        ...filters?.campaign,
                        $and: [
                            {
                                $or: [{ starts_at: null }, { starts_at: { $lte: now } }],
                            },
                            {
                                $or: [{ ends_at: null }, { ends_at: { $gt: now } }],
                            },
                        ],
                    },
                },
            ],
        };
        return await this.promotionService_.list(activeFilters, config, sharedContext);
    }
    async registerCampaignBudgetUsageByAttribute_(budgetId, attributeValue, sharedContext = {}) {
        const [campaignBudgetUsagePerAttributeValue] = await this.campaignBudgetUsageService_.list({
            budget_id: budgetId,
            attribute_value: attributeValue,
        }, { relations: ["budget"] }, sharedContext);
        if (!campaignBudgetUsagePerAttributeValue) {
            await this.campaignBudgetUsageService_.create({
                budget_id: budgetId,
                attribute_value: attributeValue,
                used: utils_1.MathBN.convert(1),
            }, sharedContext);
        }
        else {
            const limit = campaignBudgetUsagePerAttributeValue.budget.limit;
            const newUsedValue = utils_1.MathBN.add(campaignBudgetUsagePerAttributeValue.used ?? 0, 1);
            if (limit && utils_1.MathBN.gt(newUsedValue, limit)) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "Promotion usage exceeds the budget limit.");
            }
            await this.campaignBudgetUsageService_.update({
                id: campaignBudgetUsagePerAttributeValue.id,
                used: newUsedValue,
            }, sharedContext);
        }
    }
    async revertCampaignBudgetUsageByAttribute_(budgetId, attributeValue, sharedContext = {}) {
        const [campaignBudgetUsagePerAttributeValue] = await this.campaignBudgetUsageService_.list({
            budget_id: budgetId,
            attribute_value: attributeValue,
        }, {}, sharedContext);
        if (!campaignBudgetUsagePerAttributeValue) {
            return;
        }
        if (utils_1.MathBN.lte(campaignBudgetUsagePerAttributeValue.used ?? 0, 1)) {
            await this.campaignBudgetUsageService_.delete(campaignBudgetUsagePerAttributeValue.id, sharedContext);
        }
        else {
            await this.campaignBudgetUsageService_.update({
                id: campaignBudgetUsagePerAttributeValue.id,
                used: utils_1.MathBN.sub(campaignBudgetUsagePerAttributeValue.used ?? 0, 1),
            }, sharedContext);
        }
    }
    /**
     * Register the usage of promotions in the campaign budget and
     * increment the used value if the budget is not exceeded,
     * throws an error if the budget is exceeded.
     *
     * @param computedActions - The computed actions to register usage for.
     * @param registrationContext - The context of the campaign budget usage.
     * @returns void
     * @throws {MedusaError} - If the promotion usage exceeds the budget limit.
     */
    async registerUsage(computedActions, registrationContext, sharedContext = {}) {
        const promotionCodes = computedActions
            .map((computedAction) => computedAction.code)
            .filter(Boolean);
        const campaignBudgetMap = new Map();
        const promotionCodeUsageMap = new Map();
        const promotionUsageMap = new Map();
        const existingPromotions = await this.listActivePromotions_({ code: promotionCodes }, { relations: ["campaign", "campaign.budget", "campaign.budget.usages"] }, sharedContext);
        for (const promotion of existingPromotions) {
            if (promotion.campaign?.budget) {
                campaignBudgetMap.set(promotion.campaign?.budget.id, promotion.campaign?.budget);
            }
        }
        const existingPromotionsMap = new Map(existingPromotions.map((promotion) => [promotion.code, promotion]));
        for (let computedAction of computedActions) {
            const promotion = existingPromotionsMap.get(computedAction.code);
            if (!promotion) {
                continue;
            }
            if (typeof promotion.limit === "number") {
                const newUsedValue = (promotion.used ?? 0) + 1;
                if (newUsedValue > promotion.limit) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "Promotion usage exceeds the limit.");
                }
                promotionUsageMap.set(promotion.id, {
                    id: promotion.id,
                    used: newUsedValue,
                });
            }
            const campaignBudget = promotion.campaign?.budget;
            if (!campaignBudget) {
                continue;
            }
            if (campaignBudget.type === utils_1.CampaignBudgetType.SPEND) {
                const campaignBudgetData = campaignBudgetMap.get(campaignBudget.id);
                if (!campaignBudgetData) {
                    continue;
                }
                // Calculate the new budget value
                const newUsedValue = utils_1.MathBN.add(campaignBudgetData.used ?? 0, computedAction.amount);
                if (campaignBudget.limit &&
                    utils_1.MathBN.gt(newUsedValue, campaignBudget.limit)) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "Promotion usage exceeds the budget limit.");
                }
                campaignBudgetData.used = newUsedValue;
                campaignBudgetMap.set(campaignBudget.id, campaignBudgetData);
            }
            if (campaignBudget.type === utils_1.CampaignBudgetType.USAGE) {
                const promotionAlreadyUsed = promotionCodeUsageMap.get(promotion.code) || false;
                if (promotionAlreadyUsed) {
                    continue;
                }
                const newUsedValue = utils_1.MathBN.add(campaignBudget.used ?? 0, 1);
                if (campaignBudget.limit &&
                    utils_1.MathBN.gt(newUsedValue, campaignBudget.limit)) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, "Promotion usage exceeds the budget limit.");
                }
                campaignBudgetMap.set(campaignBudget.id, {
                    id: campaignBudget.id,
                    used: newUsedValue,
                });
                promotionCodeUsageMap.set(promotion.code, true);
            }
            if (campaignBudget.type === utils_1.CampaignBudgetType.USE_BY_ATTRIBUTE) {
                const promotionAlreadyUsed = promotionCodeUsageMap.get(promotion.code) || false;
                if (promotionAlreadyUsed) {
                    continue;
                }
                const attribute = campaignBudget.attribute;
                const attributeValue = registrationContext[attribute];
                if (!attributeValue) {
                    continue;
                }
                await this.registerCampaignBudgetUsageByAttribute_(campaignBudget.id, attributeValue, sharedContext);
                const newUsedValue = utils_1.MathBN.add(campaignBudget.used ?? 0, 1);
                // update the global budget usage to keep track but it is not used anywhere atm
                campaignBudgetMap.set(campaignBudget.id, {
                    id: campaignBudget.id,
                    used: newUsedValue,
                });
                promotionCodeUsageMap.set(promotion.code, true);
            }
        }
        if (promotionUsageMap.size > 0) {
            await this.promotionService_.update(Array.from(promotionUsageMap.values()), sharedContext);
        }
        if (campaignBudgetMap.size > 0) {
            const campaignBudgetsData = [];
            for (const [_, campaignBudgetData] of campaignBudgetMap) {
                // usages by attribute are updated separatley
                if (campaignBudgetData.usages) {
                    const { usages, ...campaignBudgetDataWithoutUsages } = campaignBudgetData;
                    campaignBudgetsData.push(campaignBudgetDataWithoutUsages);
                    continue;
                }
                campaignBudgetsData.push(campaignBudgetData);
            }
            await this.campaignBudgetService_.update(campaignBudgetsData, sharedContext);
        }
    }
    async revertUsage(computedActions, registrationContext, sharedContext = {}) {
        const promotionCodeUsageMap = new Map();
        const campaignBudgetMap = new Map();
        const promotionUsageMap = new Map();
        const existingPromotions = await this.listActivePromotions_({
            code: computedActions
                .map((computedAction) => computedAction.code)
                .filter(Boolean),
        }, { relations: ["campaign", "campaign.budget"] }, sharedContext);
        for (const promotion of existingPromotions) {
            if (promotion.campaign?.budget) {
                campaignBudgetMap.set(promotion.campaign?.budget.id, promotion.campaign?.budget);
            }
        }
        const existingPromotionsMap = new Map(existingPromotions.map((promotion) => [promotion.code, promotion]));
        for (let computedAction of computedActions) {
            const promotion = existingPromotionsMap.get(computedAction.code);
            if (!promotion) {
                continue;
            }
            if (typeof promotion.limit === "number") {
                const newUsedValue = Math.max(0, (promotion.used ?? 0) - 1);
                promotionUsageMap.set(promotion.id, {
                    id: promotion.id,
                    used: newUsedValue,
                });
            }
            const campaignBudget = promotion.campaign?.budget;
            if (!campaignBudget) {
                continue;
            }
            if (campaignBudget.type === utils_1.CampaignBudgetType.SPEND) {
                const campaignBudgetData = campaignBudgetMap.get(campaignBudget.id);
                if (!campaignBudgetData) {
                    continue;
                }
                // Calculate new used value and ensure it doesn't go below 0
                const newUsedValue = utils_1.MathBN.sub(campaignBudgetData.used ?? 0, computedAction.amount);
                campaignBudgetData.used = utils_1.MathBN.lt(newUsedValue, 0) ? 0 : newUsedValue;
                campaignBudgetMap.set(campaignBudget.id, campaignBudgetData);
            }
            if (campaignBudget.type === utils_1.CampaignBudgetType.USAGE) {
                const promotionAlreadyUsed = promotionCodeUsageMap.get(promotion.code) || false;
                if (promotionAlreadyUsed) {
                    continue;
                }
                // Calculate new used value and ensure it doesn't go below 0
                const newUsedValue = utils_1.MathBN.sub(campaignBudget.used ?? 0, 1);
                const usedValue = utils_1.MathBN.lt(newUsedValue, 0) ? 0 : newUsedValue;
                campaignBudgetMap.set(campaignBudget.id, {
                    id: campaignBudget.id,
                    used: usedValue,
                });
                promotionCodeUsageMap.set(promotion.code, true);
            }
            if (campaignBudget.type === utils_1.CampaignBudgetType.USE_BY_ATTRIBUTE) {
                const promotionAlreadyUsed = promotionCodeUsageMap.get(promotion.code) || false;
                if (promotionAlreadyUsed) {
                    continue;
                }
                const attribute = campaignBudget.attribute;
                const attributeValue = registrationContext[attribute];
                if (!attributeValue) {
                    continue;
                }
                await this.revertCampaignBudgetUsageByAttribute_(campaignBudget.id, attributeValue, sharedContext);
                const newUsedValue = utils_1.MathBN.sub(campaignBudget.used ?? 0, 1);
                const usedValue = utils_1.MathBN.lt(newUsedValue, 0) ? 0 : newUsedValue;
                // update the global budget usage to keep track but it is not used anywhere atm
                campaignBudgetMap.set(campaignBudget.id, {
                    id: campaignBudget.id,
                    used: usedValue,
                });
                promotionCodeUsageMap.set(promotion.code, true);
            }
        }
        if (promotionUsageMap.size > 0) {
            await this.promotionService_.update(Array.from(promotionUsageMap.values()), sharedContext);
        }
        if (campaignBudgetMap.size > 0) {
            const campaignBudgetsData = [];
            for (const [_, campaignBudgetData] of campaignBudgetMap) {
                if (campaignBudgetData.usages) {
                    const { usages, ...campaignBudgetDataWithoutUsages } = campaignBudgetData;
                    campaignBudgetsData.push(campaignBudgetDataWithoutUsages);
                    continue;
                }
                campaignBudgetsData.push(campaignBudgetData);
            }
            await this.campaignBudgetService_.update(campaignBudgetsData, sharedContext);
        }
    }
    async computeActions(promotionCodes, applicationContext, options = {}, sharedContext = {}) {
        const { prevent_auto_promotions: preventAutoPromotions, skip_usage_limit_checks: skipUsageLimitChecks, } = options;
        const computedActions = [];
        const { items = [], shipping_methods: shippingMethods = [] } = applicationContext;
        const codeAdjustmentMap = new Map();
        // Pre-process items and shipping methods to build adjustment map efficiently
        for (const item of items) {
            if (!item.adjustments?.length)
                continue;
            for (const adjustment of item.adjustments) {
                if (!(0, utils_1.isString)(adjustment.code))
                    continue;
                if (!codeAdjustmentMap.has(adjustment.code)) {
                    codeAdjustmentMap.set(adjustment.code, { items: [], shipping: [] });
                }
                codeAdjustmentMap.get(adjustment.code).items.push(adjustment);
            }
        }
        for (const shippingMethod of shippingMethods) {
            if (!shippingMethod.adjustments?.length)
                continue;
            for (const adjustment of shippingMethod.adjustments) {
                if (!(0, utils_1.isString)(adjustment.code))
                    continue;
                if (!codeAdjustmentMap.has(adjustment.code)) {
                    codeAdjustmentMap.set(adjustment.code, { items: [], shipping: [] });
                }
                codeAdjustmentMap.get(adjustment.code).shipping.push(adjustment);
            }
        }
        const appliedCodes = Array.from(codeAdjustmentMap.keys());
        const methodIdPromoValueMap = new Map();
        const promotionCodesToApply = [...promotionCodes, ...appliedCodes];
        const uniquePromotionCodes = Array.from(new Set(promotionCodesToApply));
        let queryFilter = { code: uniquePromotionCodes };
        if (!preventAutoPromotions) {
            const rulePrefilteringFilters = await (0, build_promotion_rule_query_filter_from_context_1.buildPromotionRuleQueryFilterFromContext)(applicationContext, sharedContext);
            let prefilteredAutomaticPromotionIds = [];
            if (rulePrefilteringFilters) {
                const promotions = await this.promotionService_.list({
                    $and: [{ is_automatic: true }, rulePrefilteringFilters],
                }, { select: ["id"] }, sharedContext);
                prefilteredAutomaticPromotionIds = promotions.map((promotion) => promotion.id);
            }
            const automaticPromotionFilter = rulePrefilteringFilters
                ? {
                    id: { $in: prefilteredAutomaticPromotionIds },
                }
                : { is_automatic: true };
            queryFilter = automaticPromotionFilter
                ? {
                    $or: [{ code: uniquePromotionCodes }, automaticPromotionFilter],
                }
                : queryFilter;
        }
        const promotions = await this.listActivePromotions_(queryFilter, {
            order: { application_method: { value: "DESC" } },
            relations: [
                "application_method",
                "application_method.target_rules",
                "application_method.target_rules.values",
                "application_method.buy_rules",
                "application_method.buy_rules.values",
                "rules",
                "rules.values",
                "campaign",
                "campaign.budget",
            ],
        }, sharedContext);
        const existingPromotionsMap = new Map(promotions.map((promotion) => [promotion.code, promotion]));
        const automaticPromotionCodes = [];
        for (const promotion of promotions) {
            if (promotion.is_automatic) {
                automaticPromotionCodes.push(promotion.code);
            }
        }
        for (const [code, adjustments] of codeAdjustmentMap.entries()) {
            for (const adjustment of adjustments.items) {
                computedActions.push({
                    action: utils_1.ComputedActions.REMOVE_ITEM_ADJUSTMENT,
                    adjustment_id: adjustment.id,
                    code,
                    item_id: adjustment.item_id,
                });
            }
            for (const adjustment of adjustments.shipping) {
                computedActions.push({
                    action: utils_1.ComputedActions.REMOVE_SHIPPING_METHOD_ADJUSTMENT,
                    adjustment_id: adjustment.id,
                    code,
                    shipping_method_id: adjustment.shipping_method_id,
                });
            }
        }
        const promotionCodeSet = new Set(promotionCodes); // TODO: uniquePromotionCodes
        const automaticPromotionCodeSet = new Set(automaticPromotionCodes);
        const sortedPromotionsToApply = promotions
            .filter((p) => promotionCodeSet.has(p.code) ||
            automaticPromotionCodeSet.has(p.code))
            .sort(_utils_1.ComputeActionUtils.sortByBuyGetType);
        const eligibleBuyItemMap = new Map();
        const eligibleTargetItemMap = new Map();
        for (const promotionToApply of sortedPromotionsToApply) {
            const promotion = existingPromotionsMap.get(promotionToApply.code);
            if (!promotion.application_method) {
                continue;
            }
            const { application_method: applicationMethod, rules: promotionRules = [], } = promotion;
            if (!skipUsageLimitChecks &&
                promotion.campaign?.budget?.type === utils_1.CampaignBudgetType.USE_BY_ATTRIBUTE) {
                const attribute = promotion.campaign?.budget?.attribute;
                const budgetUsageContext = _utils_1.ComputeActionUtils.getBudgetUsageContextFromComputeActionContext(applicationContext);
                const attributeValue = budgetUsageContext[attribute];
                if (!attributeValue) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Attribute value for "${attribute}" is required by promotion campaing budget`);
                }
                const [campaignBudgetUsagePerAttribute] = (await this.campaignBudgetUsageService_.list({
                    budget_id: promotion.campaign?.budget?.id,
                    attribute_value: attributeValue,
                }, {}, sharedContext));
                if (campaignBudgetUsagePerAttribute) {
                    const action = _utils_1.ComputeActionUtils.computeActionForBudgetExceeded(promotion, 1, campaignBudgetUsagePerAttribute);
                    if (action) {
                        computedActions.push(action);
                        continue;
                    }
                }
            }
            // Check promotion usage limit
            if (!skipUsageLimitChecks && typeof promotion.limit === "number") {
                if ((promotion.used ?? 0) >= promotion.limit) {
                    computedActions.push({
                        action: utils_1.ComputedActions.PROMOTION_LIMIT_EXCEEDED,
                        code: promotion.code,
                    });
                    continue;
                }
            }
            const isCurrencyCodeValid = !(0, utils_1.isPresent)(applicationMethod.currency_code) ||
                applicationContext.currency_code === applicationMethod.currency_code;
            const isPromotionApplicable = (0, _utils_1.areRulesValidForContext)(promotionRules, applicationContext, utils_1.ApplicationMethodTargetType.ORDER);
            if (!isPromotionApplicable || !isCurrencyCodeValid) {
                continue;
            }
            if (promotion.type === utils_1.PromotionType.BUYGET) {
                const computedActionsForItems = _utils_1.ComputeActionUtils.getComputedActionsForBuyGet(promotion, applicationContext[utils_1.ApplicationMethodTargetType.ITEMS], methodIdPromoValueMap, eligibleBuyItemMap, eligibleTargetItemMap);
                computedActions.push(...computedActionsForItems);
            }
            else if (promotion.type === utils_1.PromotionType.STANDARD) {
                const isTargetOrder = applicationMethod.target_type === utils_1.ApplicationMethodTargetType.ORDER;
                const isTargetItems = applicationMethod.target_type === utils_1.ApplicationMethodTargetType.ITEMS;
                const isTargetShipping = applicationMethod.target_type ===
                    utils_1.ApplicationMethodTargetType.SHIPPING_METHODS;
                const allocationOverride = isTargetOrder
                    ? utils_1.ApplicationMethodAllocation.ACROSS
                    : undefined;
                if (isTargetOrder || isTargetItems) {
                    const computedActionsForItems = _utils_1.ComputeActionUtils.getComputedActionsForItems(promotion, applicationContext[utils_1.ApplicationMethodTargetType.ITEMS], methodIdPromoValueMap, allocationOverride);
                    computedActions.push(...computedActionsForItems);
                }
                if (isTargetShipping) {
                    const computedActionsForShippingMethods = _utils_1.ComputeActionUtils.getComputedActionsForShippingMethods(promotion, applicationContext[utils_1.ApplicationMethodTargetType.SHIPPING_METHODS], methodIdPromoValueMap);
                    computedActions.push(...computedActionsForShippingMethods);
                }
            }
        }
        (0, utils_1.transformPropertiesToBigNumber)(computedActions, { include: ["amount"] });
        return computedActions;
    }
    // @ts-expect-error
    async createPromotions(data, sharedContext = {}) {
        const input = Array.isArray(data) ? data : [data];
        const createdPromotions = await this.createPromotions_(input, sharedContext);
        const promotions = await this.listPromotions({ id: createdPromotions.map((p) => p.id) }, {
            relations: [
                "application_method",
                "application_method.target_rules",
                "application_method.target_rules.values",
                "application_method.buy_rules",
                "application_method.buy_rules.values",
                "rules",
                "rules.values",
                "campaign",
                "campaign.budget",
            ],
        }, sharedContext);
        return await this.baseRepository_.serialize(Array.isArray(data) ? promotions : promotions[0]);
    }
    async createPromotions_(data, sharedContext = {}) {
        const promotionsData = [];
        const applicationMethodsData = [];
        const campaignsData = [];
        const campaignIds = data
            .filter((d) => d.campaign_id)
            .map((d) => d.campaign_id)
            .filter((id) => (0, utils_1.isString)(id));
        const existingCampaigns = campaignIds.length > 0
            ? await this.campaignService_.list({ id: campaignIds }, { relations: ["budget"] }, sharedContext)
            : [];
        const promotionCodeApplicationMethodDataMap = new Map();
        const promotionCodeRulesDataMap = new Map();
        const methodTargetRulesMap = new Map();
        const methodBuyRulesMap = new Map();
        const promotionCodeCampaignMap = new Map();
        for (const { application_method: applicationMethodData, rules: rulesData, campaign: campaignData, campaign_id: campaignId, ...promotionData } of data) {
            promotionCodeApplicationMethodDataMap.set(promotionData.code, applicationMethodData);
            if (rulesData) {
                promotionCodeRulesDataMap.set(promotionData.code, rulesData);
            }
            if (campaignData && campaignId) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Provide either the 'campaign' or 'campaign_id' parameter; both cannot be used simultaneously.`);
            }
            if (!campaignData && !campaignId) {
                promotionsData.push({ ...promotionData });
                continue;
            }
            const existingCampaign = existingCampaigns.find((c) => c.id === campaignId);
            if (campaignId && !existingCampaign) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Could not find campaign with id - ${campaignId}`);
            }
            const campaignCurrency = campaignData?.budget?.currency_code ||
                existingCampaigns.find((c) => c.id === campaignId)?.budget
                    ?.currency_code;
            if (campaignData?.budget?.type === utils_1.CampaignBudgetType.SPEND &&
                campaignCurrency !== applicationMethodData?.currency_code) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Currency between promotion and campaigns should match`);
            }
            if (campaignData) {
                promotionCodeCampaignMap.set(promotionData.code, campaignData);
            }
            promotionsData.push({
                ...promotionData,
                campaign_id: campaignId,
            });
        }
        const createdPromotions = await this.promotionService_.create(promotionsData, sharedContext);
        for (const promotion of createdPromotions) {
            const applMethodData = promotionCodeApplicationMethodDataMap.get(promotion.code);
            const campaignData = promotionCodeCampaignMap.get(promotion.code);
            if (campaignData) {
                campaignsData.push({
                    ...campaignData,
                    promotions: [promotion],
                });
            }
            if (applMethodData) {
                const { target_rules: targetRulesData = [], buy_rules: buyRulesData = [], ...applicationMethodWithoutRules } = applMethodData;
                const applicationMethodData = {
                    ...applicationMethodWithoutRules,
                    promotion,
                };
                if (applicationMethodData.target_type ===
                    utils_1.ApplicationMethodTargetType.ORDER &&
                    targetRulesData.length) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Target rules for application method with target type (${utils_1.ApplicationMethodTargetType.ORDER}) is not allowed`);
                }
                if (promotion.type === utils_1.PromotionType.BUYGET && !buyRulesData.length) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Buy rules are required for ${utils_1.PromotionType.BUYGET} promotion type`);
                }
                if (promotion.type === utils_1.PromotionType.BUYGET &&
                    !targetRulesData.length) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Target rules are required for ${utils_1.PromotionType.BUYGET} promotion type`);
                }
                (0, _utils_1.validateApplicationMethodAttributes)(applicationMethodData, promotion);
                applicationMethodsData.push(applicationMethodData);
                if (targetRulesData.length) {
                    methodTargetRulesMap.set(promotion.id, targetRulesData);
                }
                if (buyRulesData.length) {
                    methodBuyRulesMap.set(promotion.id, buyRulesData);
                }
            }
            if (promotionCodeRulesDataMap.has(promotion.code)) {
                await this.createPromotionRulesAndValues_(promotionCodeRulesDataMap.get(promotion.code) || [], "promotions", promotion, sharedContext);
            }
        }
        const createdApplicationMethods = applicationMethodsData.length > 0
            ? await this.applicationMethodService_.create(applicationMethodsData, sharedContext)
            : [];
        const createdCampaigns = campaignsData.length > 0
            ? await this.createCampaigns(campaignsData, sharedContext)
            : [];
        for (const campaignData of campaignsData) {
            const promotions = campaignData.promotions;
            const campaign = createdCampaigns.find((c) => c.campaign_identifier === campaignData.campaign_identifier);
            if (campaign && promotions && promotions.length) {
                await this.addPromotionsToCampaign({ id: campaign.id, promotion_ids: promotions.map((p) => p.id) }, sharedContext);
            }
        }
        for (const applicationMethod of createdApplicationMethods) {
            const targetRules = methodTargetRulesMap.get(applicationMethod.promotion.id);
            if (targetRules && targetRules.length > 0) {
                await this.createPromotionRulesAndValues_(targetRules, "method_target_rules", applicationMethod, sharedContext);
            }
            const buyRules = methodBuyRulesMap.get(applicationMethod.promotion.id);
            if (buyRules && buyRules.length > 0) {
                await this.createPromotionRulesAndValues_(buyRules, "method_buy_rules", applicationMethod, sharedContext);
            }
        }
        return createdPromotions;
    }
    // @ts-expect-error
    async updatePromotions(data, sharedContext = {}) {
        const input = Array.isArray(data) ? data : [data];
        const updatedPromotions = await this.updatePromotions_(input, sharedContext);
        const promotions = await this.listPromotions({ id: updatedPromotions.map((p) => p.id) }, {
            relations: [
                "application_method",
                "application_method.target_rules",
                "application_method.target_rules.values",
                "rules",
                "rules.values",
                "campaign",
                "campaign.budget",
            ],
        }, sharedContext);
        return Array.isArray(data) ? promotions : promotions[0];
    }
    async updatePromotions_(data, sharedContext = {}) {
        const promotionIds = data.map((d) => d.id);
        const existingPromotions = await this.promotionService_.list({ id: promotionIds }, { relations: ["application_method"] });
        const existingCampaigns = await this.campaignService_.list({ id: data.map((d) => d.campaign_id).filter((d) => (0, utils_1.isPresent)(d)) }, { relations: ["budget"] });
        const existingPromotionsMap = new Map(existingPromotions.map((promotion) => [promotion.id, promotion]));
        const promotionsData = [];
        const applicationMethodsData = [];
        for (const { application_method: applicationMethodData, campaign_id: campaignId, ...promotionData } of data) {
            const existingCampaign = existingCampaigns.find((c) => c.id === campaignId);
            const existingPromotion = existingPromotionsMap.get(promotionData.id);
            const existingApplicationMethod = existingPromotion?.application_method;
            const promotionCurrencyCode = existingApplicationMethod?.currency_code ||
                applicationMethodData?.currency_code;
            // Validate promotion limit cannot be less than current usage
            if ((0, utils_1.isDefined)(promotionData.limit) && promotionData.limit !== null) {
                const currentUsed = existingPromotion.used ?? 0;
                if (promotionData.limit < currentUsed) {
                    throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Promotion limit (${promotionData.limit}) cannot be less than current usage (${currentUsed})`);
                }
            }
            if (campaignId && !existingCampaign) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Could not find campaign with id ${campaignId}`);
            }
            if (campaignId &&
                existingCampaign?.budget?.type === utils_1.CampaignBudgetType.SPEND &&
                existingCampaign.budget.currency_code !== promotionCurrencyCode) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Currency code doesn't match for campaign (${campaignId}) and promotion (${existingPromotion.id})`);
            }
            if ((0, utils_1.isDefined)(campaignId)) {
                promotionsData.push({ ...promotionData, campaign_id: campaignId });
            }
            else {
                promotionsData.push(promotionData);
            }
            if (!applicationMethodData || !existingApplicationMethod) {
                continue;
            }
            if (applicationMethodData.allocation &&
                !_utils_1.allowedAllocationForQuantity.includes(applicationMethodData.allocation)) {
                applicationMethodData.max_quantity = null;
                existingApplicationMethod.max_quantity = null;
            }
            (0, _utils_1.validateApplicationMethodAttributes)(applicationMethodData, existingPromotion);
            applicationMethodsData.push({
                ...applicationMethodData,
                id: existingApplicationMethod.id,
            });
        }
        const updatedPromotions = this.promotionService_.update(promotionsData, sharedContext);
        if (applicationMethodsData.length) {
            await this.applicationMethodService_.update(applicationMethodsData, sharedContext);
        }
        return updatedPromotions;
    }
    // @ts-ignore
    async updatePromotionRules(data, sharedContext = {}) {
        const updatedPromotionRules = await this.updatePromotionRules_(data, sharedContext);
        return await this.listPromotionRules({ id: updatedPromotionRules.map((r) => r.id) }, { relations: ["values"] }, sharedContext);
    }
    async updatePromotionRules_(data, sharedContext = {}) {
        const promotionRuleIds = data.map((d) => d.id);
        const promotionRules = await this.promotionRuleService_.list({ id: promotionRuleIds }, { relations: ["values"] }, sharedContext);
        const existingPromotionRuleIds = [];
        const promotionRulesMap = new Map();
        for (const promotionRule of promotionRules) {
            existingPromotionRuleIds.push(promotionRule.id);
            promotionRulesMap.set(promotionRule.id, promotionRule);
        }
        const invalidRuleId = (0, utils_1.arrayDifference)((0, utils_1.deduplicate)(promotionRuleIds), existingPromotionRuleIds);
        if (invalidRuleId.length) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Promotion rules with id - ${invalidRuleId.join(", ")} not found`);
        }
        const rulesToUpdate = [];
        const ruleValueIdsToDelete = [];
        const ruleValuesToCreate = [];
        for (const promotionRuleData of data) {
            const { values, ...rest } = promotionRuleData;
            const normalizedValues = Array.isArray(values) ? values : [values];
            rulesToUpdate.push(rest);
            if ((0, utils_1.isDefined)(values)) {
                const promotionRule = promotionRulesMap.get(promotionRuleData.id);
                ruleValueIdsToDelete.push(...promotionRule.values.map((v) => v.id));
                ruleValuesToCreate.push(...normalizedValues.map((value) => ({
                    value,
                    promotion_rule: promotionRule,
                })));
            }
        }
        const [updatedRules] = await Promise.all([
            this.promotionRuleService_.update(rulesToUpdate, sharedContext),
            this.promotionRuleValueService_.delete(ruleValueIdsToDelete, sharedContext),
            this.promotionRuleValueService_.create(ruleValuesToCreate, sharedContext),
        ]);
        return updatedRules;
    }
    async addPromotionRules(promotionId, rulesData, sharedContext = {}) {
        const promotion = await this.promotionService_.retrieve(promotionId);
        const createdPromotionRules = await this.createPromotionRulesAndValues_(rulesData, "promotions", promotion, sharedContext);
        return this.listPromotionRules({ id: createdPromotionRules.map((r) => r.id) }, { relations: ["values"] }, sharedContext);
    }
    async addPromotionTargetRules(promotionId, rulesData, sharedContext = {}) {
        const promotion = await this.promotionService_.retrieve(promotionId, {
            relations: ["application_method"],
        });
        const applicationMethod = promotion.application_method;
        if (!applicationMethod) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `application_method for promotion not found`);
        }
        const createdPromotionRules = await this.createPromotionRulesAndValues_(rulesData, "method_target_rules", applicationMethod, sharedContext);
        return await this.listPromotionRules({ id: createdPromotionRules.map((pr) => pr.id) }, { relations: ["values"] }, sharedContext);
    }
    async addPromotionBuyRules(promotionId, rulesData, sharedContext = {}) {
        const promotion = await this.promotionService_.retrieve(promotionId, { relations: ["application_method"] }, sharedContext);
        const applicationMethod = promotion.application_method;
        if (!applicationMethod) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `application_method for promotion not found`);
        }
        const createdPromotionRules = await this.createPromotionRulesAndValues_(rulesData, "method_buy_rules", applicationMethod, sharedContext);
        return await this.listPromotionRules({ id: createdPromotionRules.map((pr) => pr.id) }, { relations: ["values"] }, sharedContext);
    }
    async createPromotionRulesAndValues_(rulesData, relationName, relation, sharedContext = {}) {
        const MikroORMApplicationMethod = (0, utils_1.toMikroORMEntity)(_models_1.ApplicationMethod);
        const createdPromotionRules = [];
        const promotion = relation instanceof MikroORMApplicationMethod
            ? relation.promotion
            : relation;
        if (!rulesData.length) {
            return [];
        }
        if (relationName === "method_buy_rules" &&
            promotion.type === utils_1.PromotionType.STANDARD) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Can't add buy rules to a ${utils_1.PromotionType.STANDARD} promotion`);
        }
        (0, _utils_1.validatePromotionRuleAttributes)(rulesData);
        const promotionRuleValuesDataToCreate = [];
        for (const ruleData of rulesData) {
            const { values, ...rest } = ruleData;
            const promotionRuleData = {
                ...rest,
                [relationName]: [relation],
            };
            const [createdPromotionRule] = await this.promotionRuleService_.create([promotionRuleData], sharedContext);
            createdPromotionRules.push(createdPromotionRule);
            const ruleValues = Array.isArray(values) ? values : [values];
            const promotionRuleValuesData = ruleValues.map((ruleValue) => ({
                value: ruleValue,
                promotion_rule: createdPromotionRule,
            }));
            promotionRuleValuesDataToCreate.push(...promotionRuleValuesData);
        }
        await this.promotionRuleValueService_.create(promotionRuleValuesDataToCreate, sharedContext);
        return createdPromotionRules;
    }
    async removePromotionRules(promotionId, ruleIds, sharedContext = {}) {
        await this.removePromotionRules_(promotionId, ruleIds, sharedContext);
    }
    async removePromotionRules_(promotionId, ruleIds, sharedContext = {}) {
        const promotion = await this.promotionService_.retrieve(promotionId, { relations: ["rules"] }, sharedContext);
        const existingRuleIds = promotion.rules.map((rule) => rule.id);
        const idsToRemove = ruleIds.filter((id) => existingRuleIds.includes(id));
        await this.promotionRuleService_.delete(idsToRemove, sharedContext);
    }
    async removePromotionTargetRules(promotionId, ruleIds, sharedContext = {}) {
        await this.removeApplicationMethodRules_(promotionId, ruleIds, _types_1.ApplicationMethodRuleTypes.TARGET_RULES, sharedContext);
    }
    async removePromotionBuyRules(promotionId, ruleIds, sharedContext = {}) {
        await this.removeApplicationMethodRules_(promotionId, ruleIds, _types_1.ApplicationMethodRuleTypes.BUY_RULES, sharedContext);
    }
    async removeApplicationMethodRules_(promotionId, ruleIds, relation, sharedContext = {}) {
        const promotion = await this.promotionService_.retrieve(promotionId, { relations: [`application_method.${relation}`] }, sharedContext);
        const applicationMethod = promotion.application_method;
        if (!applicationMethod) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `application_method for promotion not found`);
        }
        const targetRuleIdsToRemove = applicationMethod[relation]
            .filter((rule) => ruleIds.includes(rule.id))
            .map((rule) => rule.id);
        await this.promotionRuleService_.delete(targetRuleIdsToRemove, sharedContext);
    }
    // @ts-expect-error
    async createCampaigns(data, sharedContext = {}) {
        const input = Array.isArray(data) ? data : [data];
        const createdCampaigns = await this.createCampaigns_(input, sharedContext);
        const campaigns = await this.listCampaigns({ id: createdCampaigns.map((p) => p.id) }, {
            relations: ["budget", "promotions"],
        }, sharedContext);
        return Array.isArray(data) ? campaigns : campaigns[0];
    }
    async createCampaigns_(data, sharedContext = {}) {
        const campaignsData = [];
        const campaignBudgetsData = [];
        const campaignIdentifierBudgetMap = new Map();
        for (const createCampaignData of data) {
            const { budget: campaignBudgetData, ...campaignData } = createCampaignData;
            if (campaignBudgetData) {
                campaignIdentifierBudgetMap.set(campaignData.campaign_identifier, campaignBudgetData);
            }
            campaignsData.push({
                ...campaignData,
            });
        }
        const createdCampaigns = await this.campaignService_.create(campaignsData, sharedContext);
        for (const createdCampaign of createdCampaigns) {
            const campaignBudgetData = campaignIdentifierBudgetMap.get(createdCampaign.campaign_identifier);
            if (campaignBudgetData) {
                this.validateCampaignBudgetData(campaignBudgetData);
                campaignBudgetsData.push({
                    ...campaignBudgetData,
                    campaign: createdCampaign.id,
                });
            }
        }
        if (campaignBudgetsData.length) {
            await this.campaignBudgetService_.create(campaignBudgetsData, sharedContext);
        }
        return createdCampaigns;
    }
    validateCampaignBudgetData(data) {
        if (!data.type) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Campaign Budget type is a required field`);
        }
        if (data.type === utils_1.CampaignBudgetType.SPEND &&
            !(0, utils_1.isPresent)(data.currency_code)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Campaign Budget type is a required field`);
        }
    }
    // @ts-expect-error
    async updateCampaigns(data, sharedContext = {}) {
        const input = Array.isArray(data) ? data : [data];
        const updatedCampaigns = await this.updateCampaigns_(input, sharedContext);
        const campaigns = await this.listCampaigns({ id: updatedCampaigns.map((p) => p.id) }, {
            relations: ["budget", "promotions"],
        }, sharedContext);
        return Array.isArray(data) ? campaigns : campaigns[0];
    }
    async updateCampaigns_(data, sharedContext = {}) {
        const campaignIds = data.map((d) => d.id);
        const campaignsData = [];
        const updateBudgetData = [];
        const createBudgetData = [];
        const existingCampaigns = await this.campaignService_.list({ id: campaignIds }, { relations: ["budget"] }, sharedContext);
        const existingCampaignsMap = new Map(existingCampaigns.map((campaign) => [campaign.id, campaign]));
        for (const updateCampaignData of data) {
            const { budget: budgetData, ...campaignData } = updateCampaignData;
            const existingCampaign = existingCampaignsMap.get(campaignData.id);
            campaignsData.push(campaignData);
            // Type & currency code of the budget is immutable, we don't allow for it to be updated.
            // If an existing budget is present, we remove the type and currency from being updated
            if ((existingCampaign?.budget && budgetData?.type) ||
                budgetData?.currency_code) {
                delete budgetData?.type;
                delete budgetData?.currency_code;
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Campaign budget attributes (type, currency_code) are immutable`);
            }
            if (budgetData) {
                if (existingCampaign?.budget) {
                    updateBudgetData.push({
                        id: existingCampaign.budget.id,
                        ...budgetData,
                    });
                }
                else {
                    createBudgetData.push({
                        ...budgetData,
                        campaign: existingCampaign.id,
                    });
                }
            }
        }
        const updatedCampaigns = await this.campaignService_.update(campaignsData, sharedContext);
        if (updateBudgetData.length) {
            await this.campaignBudgetService_.update(updateBudgetData, sharedContext);
        }
        if (createBudgetData.length) {
            await this.campaignBudgetService_.create(createBudgetData, sharedContext);
        }
        return updatedCampaigns;
    }
    async addPromotionsToCampaign(data, sharedContext = {}) {
        const ids = await this.addPromotionsToCampaign_(data, sharedContext);
        return { ids };
    }
    // TODO:
    // - introduce currency_code to promotion
    // - allow promotions to be queried by currency code
    // - when the above is present, validate adding promotion to campaign based on currency code
    async addPromotionsToCampaign_(data, sharedContext = {}) {
        const { id, promotion_ids: promotionIds = [] } = data;
        const campaign = await this.campaignService_.retrieve(id, {}, sharedContext);
        const promotionsToAdd = await this.promotionService_.list({ id: promotionIds, campaign_id: null }, { relations: ["application_method"] }, sharedContext);
        const diff = (0, utils_1.arrayDifference)(promotionsToAdd.map((p) => p.id), promotionIds);
        if (diff.length > 0) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Cannot add promotions (${diff.join(",")}) to campaign. These promotions are either already part of a campaign or not found.`);
        }
        const promotionsWithInvalidCurrency = promotionsToAdd.filter((promotion) => campaign.budget?.type === utils_1.CampaignBudgetType.SPEND &&
            promotion.application_method?.currency_code !==
                campaign?.budget?.currency_code);
        if (promotionsWithInvalidCurrency.length > 0) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Cannot add promotions to campaign where currency_code don't match.`);
        }
        await this.promotionService_.update(promotionsToAdd.map((promotion) => ({
            id: promotion.id,
            campaign_id: campaign.id,
        })), sharedContext);
        return promotionsToAdd.map((promo) => promo.id);
    }
    async removePromotionsFromCampaign(data, sharedContext = {}) {
        const ids = await this.removePromotionsFromCampaign_(data, sharedContext);
        return { ids };
    }
    async removePromotionsFromCampaign_(data, sharedContext = {}) {
        const { id, promotion_ids: promotionIds = [] } = data;
        await this.campaignService_.retrieve(id, {}, sharedContext);
        const promotionsToRemove = await this.promotionService_.list({ id: promotionIds }, {}, sharedContext);
        const diff = (0, utils_1.arrayDifference)(promotionsToRemove.map((p) => p.id), promotionIds);
        if (diff.length > 0) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Promotions with ids (${diff.join(",")}) not found.`);
        }
        await this.promotionService_.update(promotionsToRemove.map((promotion) => ({
            id: promotion.id,
            campaign_id: null,
        })), sharedContext);
        return promotionsToRemove.map((promo) => promo.id);
    }
}
exports.default = PromotionModuleService;
__decorate([
    (0, utils_1.InjectManager)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "listActivePromotions", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "listActivePromotions_", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "registerCampaignBudgetUsageByAttribute_", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "revertCampaignBudgetUsageByAttribute_", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    (0, utils_1.EmitEvents)()
    /**
     * Register the usage of promotions in the campaign budget and
     * increment the used value if the budget is not exceeded,
     * throws an error if the budget is exceeded.
     *
     * @param computedActions - The computed actions to register usage for.
     * @param registrationContext - The context of the campaign budget usage.
     * @returns void
     * @throws {MedusaError} - If the promotion usage exceeds the budget limit.
     */
    ,
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "registerUsage", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    (0, utils_1.EmitEvents)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "revertUsage", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(3, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "computeActions", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "createPromotions", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "createPromotions_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "updatePromotions", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "updatePromotions_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-ignore
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "updatePromotionRules", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "updatePromotionRules_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "addPromotionRules", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "addPromotionTargetRules", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "addPromotionBuyRules", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(3, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String, Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "createPromotionRulesAndValues_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "removePromotionRules", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "removePromotionRules_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "removePromotionTargetRules", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "removePromotionBuyRules", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(3, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "removeApplicationMethodRules_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "createCampaigns", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "createCampaigns_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "updateCampaigns", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "updateCampaigns_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "addPromotionsToCampaign", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "addPromotionsToCampaign_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "removePromotionsFromCampaign", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PromotionModuleService.prototype, "removePromotionsFromCampaign_", null);
//# sourceMappingURL=promotion-module.js.map