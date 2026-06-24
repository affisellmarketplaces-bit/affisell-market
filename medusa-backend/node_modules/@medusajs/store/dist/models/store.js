"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const currency_1 = __importDefault(require("./currency"));
const locale_1 = __importDefault(require("./locale"));
const Store = utils_1.model
    .define("Store", {
    id: utils_1.model.id({ prefix: "store" }).primaryKey(),
    name: utils_1.model.text().default("Medusa Store").searchable(),
    default_sales_channel_id: utils_1.model.text().nullable(),
    default_region_id: utils_1.model.text().nullable(),
    default_location_id: utils_1.model.text().nullable(),
    metadata: utils_1.model.json().nullable(),
    supported_currencies: utils_1.model.hasMany(() => currency_1.default, {
        mappedBy: "store",
    }),
    /**
     * The supported locales of the store.
     *
     * @since 2.12.3
     */
    supported_locales: utils_1.model.hasMany(() => locale_1.default, {
        mappedBy: "store",
    }),
})
    .cascades({
    delete: ["supported_currencies", "supported_locales"],
});
exports.default = Store;
//# sourceMappingURL=store.js.map