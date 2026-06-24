"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortLineItemByPriceAscending = sortLineItemByPriceAscending;
exports.sortShippingLineByPriceAscending = sortShippingLineByPriceAscending;
const utils_1 = require("@medusajs/framework/utils");
function sortLineItemByPriceAscending(a, b) {
    const priceA = utils_1.MathBN.div(a.subtotal, a.quantity);
    const priceB = utils_1.MathBN.div(b.subtotal, b.quantity);
    return utils_1.MathBN.lt(priceA, priceB) ? -1 : 1;
}
function sortShippingLineByPriceAscending(a, b) {
    const priceA = a.subtotal ?? 0;
    const priceB = b.subtotal ?? 0;
    return utils_1.MathBN.lt(priceA, priceB) ? -1 : 1;
}
//# sourceMappingURL=sort-by-price.js.map