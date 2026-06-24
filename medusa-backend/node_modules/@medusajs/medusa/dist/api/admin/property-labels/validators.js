"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminBatchPropertyLabels = exports.AdminUpdatePropertyLabel = exports.AdminCreatePropertyLabel = exports.AdminPropertyLabelListParams = exports.AdminPropertyLabelParams = void 0;
const zod_1 = require("zod");
const validators_1 = require("../../utils/validators");
/**
 * Query parameters for listing property labels.
 */
exports.AdminPropertyLabelParams = (0, validators_1.createSelectParams)();
/**
 * Query parameters for filtering property labels.
 */
exports.AdminPropertyLabelListParams = (0, validators_1.createSelectParams)().extend({
    entity: zod_1.z.string().optional(),
    property: zod_1.z.string().optional(),
    q: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().optional(),
    offset: zod_1.z.coerce.number().optional(),
    order: zod_1.z.string().optional(),
});
/**
 * Payload for creating a property label.
 */
exports.AdminCreatePropertyLabel = zod_1.z.object({
    entity: zod_1.z.string().min(1),
    property: zod_1.z.string().min(1),
    label: zod_1.z.string().min(1),
    description: zod_1.z.string().nullish(),
});
/**
 * Payload for updating a property label.
 */
exports.AdminUpdatePropertyLabel = zod_1.z.object({
    label: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().nullish(),
});
/**
 * Payload for batch property label operations.
 */
exports.AdminBatchPropertyLabels = zod_1.z.object({
    create: zod_1.z
        .array(zod_1.z.object({
        entity: zod_1.z.string().min(1),
        property: zod_1.z.string().min(1),
        label: zod_1.z.string().min(1),
        description: zod_1.z.string().nullish(),
    }))
        .optional(),
    update: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().min(1),
        label: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().nullish(),
    }))
        .optional(),
    delete: zod_1.z.array(zod_1.z.string()).optional(),
});
//# sourceMappingURL=validators.js.map