"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewConfiguration = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.ViewConfiguration = utils_1.model
    .define("view_configuration", {
    id: utils_1.model.id({ prefix: "vconf" }).primaryKey(),
    entity: utils_1.model.text().searchable(),
    name: utils_1.model.text().searchable().nullable(),
    user_id: utils_1.model.text().nullable(),
    is_system_default: utils_1.model.boolean().default(false),
    configuration: utils_1.model.json(),
})
    .indexes([
    {
        on: ["entity", "user_id"],
    },
    {
        on: ["entity", "is_system_default"],
    },
    {
        on: ["user_id"],
    },
]);
//# sourceMappingURL=view-configuration.js.map