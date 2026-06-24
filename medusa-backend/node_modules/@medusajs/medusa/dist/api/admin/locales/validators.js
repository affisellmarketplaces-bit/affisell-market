"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminGetLocalesParams = exports.AdminGetLocalesParamsFields = exports.AdminGetLocaleParams = void 0;
const zod_1 = require("@medusajs/framework/zod");
const validators_1 = require("../../utils/validators");
const common_validators_1 = require("../../utils/common-validators");
exports.AdminGetLocaleParams = (0, validators_1.createSelectParams)();
exports.AdminGetLocalesParamsFields = zod_1.z.object({
    q: zod_1.z.string().optional(),
    code: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
});
exports.AdminGetLocalesParams = (0, validators_1.createFindParams)({
    offset: 0,
    limit: 200,
})
    .merge(exports.AdminGetLocalesParamsFields)
    .merge((0, common_validators_1.applyAndAndOrOperators)(exports.AdminGetLocalesParamsFields));
//# sourceMappingURL=validators.js.map