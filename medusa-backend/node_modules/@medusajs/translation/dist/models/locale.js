"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const Locale = utils_1.model
    .define("locale", {
    id: utils_1.model.id({ prefix: "loc" }).primaryKey(),
    /**
     * The BCP 47 language tag code of the locale (e.g., "en-US", "da-DK").
     */
    code: utils_1.model.text().searchable(),
    /**
     * The human-readable name of the locale (e.g., "English (US)", "Danish").
     */
    name: utils_1.model.text().searchable(),
})
    .indexes([
    {
        on: ["code"],
        unique: true,
    },
]);
exports.default = Locale;
//# sourceMappingURL=locale.js.map