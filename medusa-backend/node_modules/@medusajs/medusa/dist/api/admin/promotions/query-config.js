"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRuleValueTransformQueryConfig = exports.listRuleTransformQueryConfig = exports.retrieveRuleTransformQueryConfig = exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminPromotionRuleFields = exports.defaultAdminPromotionFields = exports.Entities = void 0;
var Entities;
(function (Entities) {
    Entities["promotion"] = "promotion";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminPromotionFields = [
    "id",
    "code",
    "is_automatic",
    "is_tax_inclusive",
    "type",
    "limit",
    "used",
    "status",
    "created_at",
    "updated_at",
    "deleted_at",
    "*campaign",
    "*campaign.budget",
    "*application_method",
    "*application_method.buy_rules",
    "application_method.buy_rules.values.value",
    "*application_method.target_rules",
    "application_method.target_rules.values.value",
    "rules.id",
    "rules.attribute",
    "rules.operator",
    "rules.values.value",
];
exports.defaultAdminPromotionRuleFields = [
    "id",
    "description",
    "attribute",
    "operator",
    "values.value",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminPromotionFields,
    isList: false,
    entity: Entities.promotion,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.promotion,
};
exports.retrieveRuleTransformQueryConfig = {
    defaults: exports.defaultAdminPromotionRuleFields,
    isList: false,
};
exports.listRuleTransformQueryConfig = {
    ...exports.retrieveRuleTransformQueryConfig,
    isList: true,
};
exports.listRuleValueTransformQueryConfig = {
    defaults: [],
    allowed: [],
    isList: true,
};
//# sourceMappingURL=query-config.js.map