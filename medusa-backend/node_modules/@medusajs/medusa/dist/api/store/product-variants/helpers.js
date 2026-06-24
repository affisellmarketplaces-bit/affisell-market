"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapVariantsWithTaxPrices = void 0;
const utils_1 = require("@medusajs/framework/utils");
const utils_2 = require("@medusajs/framework/utils");
const translation_1 = __importDefault(require("../../../feature-flags/translation"));
const wrapVariantsWithTaxPrices = async (req, variants) => {
    if (!req.taxContext?.taxInclusivityContext ||
        !req.taxContext?.taxLineContext) {
        return;
    }
    if (!variants?.length) {
        return;
    }
    const items = variants
        .map(asTaxItem)
        .filter((item) => !!item);
    if (!items.length) {
        return;
    }
    const taxService = req.scope.resolve(utils_1.Modules.TAX);
    let taxLines = (await taxService.getTaxLines(items, req.taxContext.taxLineContext));
    const isTranslationEnabled = utils_1.FeatureFlag.isFeatureEnabled(translation_1.default.key);
    if (isTranslationEnabled) {
        taxLines = (await (0, utils_2.applyTranslationsToTaxLines)(taxLines, req.locale, req.scope));
    }
    const taxRatesMap = new Map();
    taxLines.forEach((taxLine) => {
        if (!taxRatesMap.has(taxLine.line_item_id)) {
            taxRatesMap.set(taxLine.line_item_id, []);
        }
        taxRatesMap.get(taxLine.line_item_id).push(taxLine);
    });
    variants.forEach((variant) => {
        if (!variant.calculated_price) {
            return;
        }
        const taxRatesForVariant = taxRatesMap.get(variant.id) || [];
        const { priceWithTax, priceWithoutTax } = (0, utils_1.calculateAmountsWithTax)({
            taxLines: taxRatesForVariant,
            amount: variant.calculated_price.calculated_amount,
            includesTax: variant.calculated_price.is_calculated_price_tax_inclusive,
        });
        variant.calculated_price.calculated_amount_with_tax = priceWithTax;
        variant.calculated_price.calculated_amount_without_tax = priceWithoutTax;
        const { priceWithTax: originalPriceWithTax, priceWithoutTax: originalPriceWithoutTax, } = (0, utils_1.calculateAmountsWithTax)({
            taxLines: taxRatesForVariant,
            amount: variant.calculated_price.original_amount,
            includesTax: variant.calculated_price.is_original_price_tax_inclusive,
        });
        variant.calculated_price.original_amount_with_tax = originalPriceWithTax;
        variant.calculated_price.original_amount_without_tax =
            originalPriceWithoutTax;
    });
};
exports.wrapVariantsWithTaxPrices = wrapVariantsWithTaxPrices;
const asTaxItem = (variant) => {
    if (!variant.calculated_price) {
        return;
    }
    const productId = variant.product_id ?? variant.product?.id;
    if (!productId) {
        return;
    }
    return {
        id: variant.id,
        product_id: productId,
        product_type_id: variant.product?.type_id ?? undefined,
        quantity: 1,
        unit_price: variant.calculated_price.calculated_amount,
        currency_code: variant.calculated_price.currency_code,
    };
};
//# sourceMappingURL=helpers.js.map