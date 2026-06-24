"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const store_1 = __importDefault(require("./store"));
/**
 * @since 2.12.3
 */
const StoreLocale = utils_1.model.define("StoreLocale", {
    id: utils_1.model.id({ prefix: "stloc" }).primaryKey(),
    /**
     * The BCP 47 language tag code of the locale.
     *
     * @example
     * "en-US"
     */
    locale_code: utils_1.model.text().searchable(),
    store: utils_1.model
        .belongsTo(() => store_1.default, {
        mappedBy: "supported_locales",
    })
        .nullable(),
});
exports.default = StoreLocale;
//# sourceMappingURL=locale.js.map