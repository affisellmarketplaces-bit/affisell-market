"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminIndexSyncPayload = void 0;
const zod_1 = require("@medusajs/framework/zod");
exports.AdminIndexSyncPayload = zod_1.z.object({
    strategy: zod_1.z.enum(["full", "reset"]).optional(),
});
//# sourceMappingURL=validator.js.map