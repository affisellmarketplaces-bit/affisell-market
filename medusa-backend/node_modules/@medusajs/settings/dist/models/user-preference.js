"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreference = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.UserPreference = utils_1.model
    .define("user_preference", {
    id: utils_1.model.id({ prefix: "usrpref" }).primaryKey(),
    user_id: utils_1.model.text(),
    key: utils_1.model.text().searchable(),
    value: utils_1.model.json(),
})
    .indexes([
    {
        on: ["user_id", "key"],
        unique: true,
    },
    {
        on: ["user_id"],
    },
]);
//# sourceMappingURL=user-preference.js.map