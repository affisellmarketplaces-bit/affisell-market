"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
const utils_2 = require("../../../utils");
const index_engine_1 = __importDefault(require("../../../../../../feature-flags/index-engine"));
/*
  Entry points that exist as top-level types in the Index module's default schema
  (packages/modules/index/src/utils/default-schema.ts). Only `product` qualifies
  today; the other entry points this endpoint may receive (product_category,
  product_collection, product_type, product_tag, region, currency, customer_group,
  country, sales_channel, shipping_option_type) are not top-level types in the
  index, so they keep using query.graph.
*/
const ENTITIES_SUPPORTED_BY_INDEX_ENGINE = ["product"];
/*
  This endpoint returns all the potential values for rules (promotion rules, target rules and buy rules)
  given an attribute of a rule. The response for different rule_attributes are returned uniformly
  as an array of labels and values.
  Eg. If the rule_attribute requested is "currency_code" for "rules" rule type, we return currencies
  from the currency module.
*/
const GET = async (req, res) => {
    const { rule_type: ruleType, rule_attribute_id: ruleAttributeId } = req.params;
    const queryConfig = utils_2.ruleQueryConfigurations[ruleAttributeId];
    const filterableFields = req.filterableFields;
    if (filterableFields.value) {
        filterableFields[queryConfig.valueAttr] = filterableFields.value;
        delete filterableFields.value;
    }
    (0, utils_2.validateRuleType)(ruleType);
    (0, utils_2.validateRuleAttribute)({
        ruleType: ruleType,
        ruleAttributeId,
        promotionType: undefined,
        applicationMethodType: undefined,
        applicationMethodTargetType: filterableFields.application_method_target_type,
    });
    if (filterableFields.application_method_target_type) {
        delete filterableFields.application_method_target_type;
    }
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const fields = [queryConfig.labelAttr, queryConfig.valueAttr];
    const useIndexEngine = utils_1.FeatureFlag.isFeatureEnabled(index_engine_1.default.key) &&
        ENTITIES_SUPPORTED_BY_INDEX_ENGINE.includes(queryConfig.entryPoint);
    if (useIndexEngine) {
        // TODO: Remove once we implement search by relations in a similar way to query.graph
        const filters = { ...filterableFields };
        if (!!filters.q) {
            filters.variants = filters.variants ?? {};
        }
        const { data, metadata } = await query.index({
            entity: queryConfig.entryPoint,
            fields,
            filters,
            pagination: req.queryConfig.pagination,
        });
        const values = data.map((r) => ({
            label: r[queryConfig.labelAttr],
            value: r[queryConfig.valueAttr],
        }));
        res.json({
            values,
            count: metadata.estimate_count,
            estimate_count: metadata.estimate_count,
            offset: metadata.skip,
            limit: metadata.take,
        });
        return;
    }
    const { data, metadata } = await query.graph({
        entity: queryConfig.entryPoint,
        fields,
        filters: filterableFields,
        pagination: req.queryConfig.pagination,
    });
    const values = data.map((r) => ({
        label: r[queryConfig.labelAttr],
        value: r[queryConfig.valueAttr],
    }));
    res.json({
        values,
        count: metadata.count,
        offset: metadata.skip,
        limit: metadata.take,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map