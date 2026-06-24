"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCurrencyCode = normalizeCurrencyCode;
const errors_1 = require("./errors");
const is_string_1 = require("./is-string");
/**
 * Normalizes `currencyCode` by transforming it to lowercase
 */
function normalizeCurrencyCode(currencyCode) {
    if (!(0, is_string_1.isString)(currencyCode)) {
        throw new errors_1.MedusaError(errors_1.MedusaErrorTypes.INVALID_ARGUMENT, "Currency code needs to be a string");
    }
    return currencyCode.toLowerCase();
}
//# sourceMappingURL=normalize-currency-code.js.map