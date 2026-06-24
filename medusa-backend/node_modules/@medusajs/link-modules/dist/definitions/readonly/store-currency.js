"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreCurrencies = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.StoreCurrencies = {
    isLink: true,
    isReadOnlyLink: true,
    extends: [
        {
            serviceName: utils_1.Modules.STORE,
            entity: "StoreCurrency",
            relationship: {
                serviceName: utils_1.Modules.CURRENCY,
                entity: "Currency",
                primaryKey: "code",
                foreignKey: "currency_code",
                alias: "currency",
                args: {
                    methodSuffix: "Currencies",
                },
            },
        },
    ],
};
//# sourceMappingURL=store-currency.js.map