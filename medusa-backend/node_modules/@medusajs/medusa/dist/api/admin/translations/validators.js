"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminTranslationEntitiesParams = exports.AdminBatchTranslationSettings = exports.AdminTranslationSettingsParams = exports.AdminTranslationStatisticsParams = exports.AdminBatchTranslations = exports.AdminUpdateTranslation = exports.AdminCreateTranslation = exports.AdminGetTranslationsParams = exports.AdminGetTranslationParamsFields = void 0;
const zod_1 = require("@medusajs/framework/zod");
const common_validators_1 = require("../../utils/common-validators");
const validators_1 = require("../../utils/validators");
exports.AdminGetTranslationParamsFields = zod_1.z.object({
    q: zod_1.z.string().optional(),
    reference_id: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    reference: zod_1.z.string().optional(),
    locale_code: zod_1.z.string().optional(),
});
exports.AdminGetTranslationsParams = (0, validators_1.createFindParams)({
    limit: 20,
    offset: 0,
})
    .merge(exports.AdminGetTranslationParamsFields)
    .merge((0, common_validators_1.applyAndAndOrOperators)(exports.AdminGetTranslationParamsFields));
exports.AdminCreateTranslation = zod_1.z.object({
    reference_id: zod_1.z.string(),
    reference: zod_1.z.string(),
    locale_code: zod_1.z.string(),
    translations: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
exports.AdminUpdateTranslation = zod_1.z.object({
    id: zod_1.z.string(),
    reference_id: zod_1.z.string().optional(),
    reference: zod_1.z.string().optional(),
    locale_code: zod_1.z.string().optional(),
    translations: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
});
exports.AdminBatchTranslations = (0, validators_1.createBatchBody)(exports.AdminCreateTranslation, exports.AdminUpdateTranslation);
exports.AdminTranslationStatisticsParams = zod_1.z
    .object({
    locales: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]),
    entity_types: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]),
})
    .transform((data) => ({
    // Normalize to arrays for consistent handling
    locales: Array.isArray(data.locales) ? data.locales : [data.locales],
    entity_types: Array.isArray(data.entity_types)
        ? data.entity_types
        : [data.entity_types],
}));
exports.AdminTranslationSettingsParams = zod_1.z.object({
    entity_type: zod_1.z.string().optional(),
    is_active: (0, common_validators_1.booleanString)().optional(),
});
const AdminUpdateTranslationSettings = zod_1.z.object({
    id: zod_1.z.string(),
    entity_type: zod_1.z.string().optional(),
    fields: zod_1.z.array(zod_1.z.string()).optional(),
    is_active: zod_1.z.boolean().optional(),
});
const AdminCreateTranslationSettings = zod_1.z.object({
    entity_type: zod_1.z.string(),
    fields: zod_1.z.array(zod_1.z.string()),
    is_active: zod_1.z.boolean().optional(),
});
exports.AdminBatchTranslationSettings = (0, validators_1.createBatchBody)(AdminCreateTranslationSettings, AdminUpdateTranslationSettings);
exports.AdminTranslationEntitiesParams = (0, validators_1.createFindParams)({
    limit: 20,
    offset: 0,
}).merge(zod_1.z.object({
    type: zod_1.z.string(),
    id: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
}));
//# sourceMappingURL=validators.js.map