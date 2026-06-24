"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTransformQueryConfig = exports.retrieveTransformQueryConfig = exports.defaultAdminStoreFields = exports.Entities = void 0;
const utils_1 = require("@medusajs/framework/utils");
const translation_1 = __importDefault(require("../../../feature-flags/translation"));
var Entities;
(function (Entities) {
    Entities["store"] = "store";
})(Entities || (exports.Entities = Entities = {}));
exports.defaultAdminStoreFields = [
    "id",
    "name",
    "*supported_currencies",
    "*supported_currencies.currency",
    ...(utils_1.FeatureFlag.isFeatureEnabled(translation_1.default.key)
        ? ["*supported_locales", "*supported_locales.locale"]
        : []),
    "default_sales_channel_id",
    "default_region_id",
    "default_location_id",
    "metadata",
    "created_at",
    "updated_at",
];
exports.retrieveTransformQueryConfig = {
    defaults: exports.defaultAdminStoreFields,
    isList: false,
    entity: Entities.store,
};
exports.listTransformQueryConfig = {
    ...exports.retrieveTransformQueryConfig,
    isList: true,
    entity: Entities.store,
};
//# sourceMappingURL=query-config.js.map