"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUpdateShippingOptionType = exports.AdminCreateShippingOptionType = exports.AdminGetShippingOptionTypesParams = exports.AdminGetShippingOptionTypesParamsFields = exports.AdminGetShippingOptionTypeParams = void 0;
const zod_1 = require("@medusajs/framework/zod");
const validators_1 = require("../../utils/validators");
const common_validators_1 = require("../../utils/common-validators");
exports.AdminGetShippingOptionTypeParams = (0, validators_1.createSelectParams)();
exports.AdminGetShippingOptionTypesParamsFields = zod_1.z.object({
    q: zod_1.z.string().optional(),
    id: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    label: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    code: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    description: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    created_at: (0, validators_1.createOperatorMap)().optional(),
    updated_at: (0, validators_1.createOperatorMap)().optional(),
    deleted_at: (0, validators_1.createOperatorMap)().optional(),
});
exports.AdminGetShippingOptionTypesParams = (0, validators_1.createFindParams)({
    limit: 10,
    offset: 0,
})
    .merge(exports.AdminGetShippingOptionTypesParamsFields)
    .merge((0, common_validators_1.applyAndAndOrOperators)(exports.AdminGetShippingOptionTypesParamsFields));
exports.AdminCreateShippingOptionType = zod_1.z
    .object({
    label: zod_1.z.string(),
    code: zod_1.z.string(),
    description: zod_1.z.string().optional(),
})
    .strict();
exports.AdminUpdateShippingOptionType = zod_1.z
    .object({
    label: zod_1.z.string().optional(),
    code: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
})
    .strict();
//# sourceMappingURL=validators.js.map