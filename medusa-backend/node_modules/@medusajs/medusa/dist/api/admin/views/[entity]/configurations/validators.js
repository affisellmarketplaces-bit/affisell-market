"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSetActiveViewConfiguration = exports.AdminUpdateViewConfiguration = exports.AdminCreateViewConfiguration = exports.AdminGetViewConfigurationsParams = exports.AdminGetViewConfigurationsParamsFields = exports.AdminGetActiveViewConfigurationParams = exports.AdminGetViewConfigurationParams = void 0;
const zod_1 = require("@medusajs/framework/zod");
const validators_1 = require("../../../../utils/validators");
const common_validators_1 = require("../../../../utils/common-validators");
exports.AdminGetViewConfigurationParams = (0, validators_1.createSelectParams)();
exports.AdminGetActiveViewConfigurationParams = (0, validators_1.createSelectParams)();
exports.AdminGetViewConfigurationsParamsFields = zod_1.z.object({
    id: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    entity: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    name: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    user_id: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string()), zod_1.z.null()]).optional(),
    is_system_default: zod_1.z.boolean().optional(),
    created_at: (0, validators_1.createOperatorMap)().optional(),
    updated_at: (0, validators_1.createOperatorMap)().optional(),
});
exports.AdminGetViewConfigurationsParams = (0, validators_1.createFindParams)({
    offset: 0,
    limit: 20,
})
    .merge(exports.AdminGetViewConfigurationsParamsFields)
    .merge((0, common_validators_1.applyAndAndOrOperators)(exports.AdminGetViewConfigurationsParamsFields));
exports.AdminCreateViewConfiguration = zod_1.z.object({
    name: zod_1.z.string().optional(),
    is_system_default: zod_1.z.boolean().optional().default(false),
    set_active: zod_1.z.boolean().optional().default(false),
    configuration: zod_1.z.object({
        visible_columns: zod_1.z.array(zod_1.z.string()),
        column_order: zod_1.z.array(zod_1.z.string()),
        column_widths: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
        filters: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
        sorting: zod_1.z.object({
            id: zod_1.z.string(),
            desc: zod_1.z.boolean(),
        }).nullable().optional(),
        search: zod_1.z.string().optional(),
    }),
});
exports.AdminUpdateViewConfiguration = zod_1.z.object({
    name: zod_1.z.string().optional(),
    is_system_default: zod_1.z.boolean().optional(),
    set_active: zod_1.z.boolean().optional().default(false),
    configuration: zod_1.z.object({
        visible_columns: zod_1.z.array(zod_1.z.string()).optional(),
        column_order: zod_1.z.array(zod_1.z.string()).optional(),
        column_widths: zod_1.z.record(zod_1.z.string(), zod_1.z.number()).optional(),
        filters: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
        sorting: zod_1.z.object({
            id: zod_1.z.string(),
            desc: zod_1.z.boolean(),
        }).nullable().optional(),
        search: zod_1.z.string().optional(),
    }).optional(),
});
exports.AdminSetActiveViewConfiguration = zod_1.z.object({
    view_configuration_id: zod_1.z.union([zod_1.z.string(), zod_1.z.null()]),
});
//# sourceMappingURL=validators.js.map