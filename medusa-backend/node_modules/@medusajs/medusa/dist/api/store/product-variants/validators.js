"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreProductVariantListParams = exports.StoreProductVariantParams = void 0;
const zod_1 = require("@medusajs/framework/zod");
const common_validators_1 = require("../../utils/common-validators");
const validators_1 = require("../../utils/validators");
const StoreProductVariantContextFields = zod_1.z.object({
    region_id: zod_1.z.string().optional(),
    country_code: zod_1.z.string().optional(),
    province: zod_1.z.string().optional(),
    cart_id: zod_1.z.string().optional(),
    sales_channel_id: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
});
const StoreProductVariantFilterFields = zod_1.z.object({
    q: zod_1.z.string().optional(),
    id: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    sku: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    product_id: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    options: zod_1.z
        .object({
        value: zod_1.z.string().optional(),
        option_id: zod_1.z.string().optional(),
    })
        .optional(),
    allow_backorder: (0, common_validators_1.booleanString)().optional(),
    manage_inventory: (0, common_validators_1.booleanString)().optional(),
    created_at: (0, validators_1.createOperatorMap)().optional(),
    updated_at: (0, validators_1.createOperatorMap)().optional(),
    deleted_at: (0, validators_1.createOperatorMap)().optional(),
});
exports.StoreProductVariantParams = (0, validators_1.createSelectParams)().merge(StoreProductVariantContextFields);
exports.StoreProductVariantListParams = (0, validators_1.createFindParams)({
    offset: 0,
    limit: 20,
})
    .merge(StoreProductVariantContextFields)
    .merge(StoreProductVariantFilterFields)
    .merge((0, common_validators_1.applyAndAndOrOperators)(StoreProductVariantFilterFields));
//# sourceMappingURL=validators.js.map