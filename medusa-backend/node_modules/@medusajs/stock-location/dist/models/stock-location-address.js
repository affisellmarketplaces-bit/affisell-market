"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const _models_1 = require(".");
const StockLocationAddress = utils_1.model
    .define("StockLocationAddress", {
    id: utils_1.model.id({ prefix: "laddr" }).primaryKey(),
    address_1: utils_1.model.text().searchable(),
    address_2: utils_1.model.text().searchable().nullable(),
    company: utils_1.model.text().nullable(),
    city: utils_1.model.text().searchable().nullable(),
    country_code: utils_1.model.text().searchable(),
    phone: utils_1.model.text().nullable(),
    province: utils_1.model.text().searchable().nullable(),
    postal_code: utils_1.model.text().searchable().nullable(),
    metadata: utils_1.model.json().nullable(),
    stock_locations: utils_1.model.hasOne(() => _models_1.StockLocation, {
        mappedBy: "address",
    }),
})
    .cascades({
    delete: ["stock_locations"],
});
exports.default = StockLocationAddress;
//# sourceMappingURL=stock-location-address.js.map