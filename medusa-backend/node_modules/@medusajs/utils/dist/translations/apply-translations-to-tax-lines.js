"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTranslationsToTaxLines = void 0;
const apply_translations_1 = require("./apply-translations");
/**
 * Applies translations to tax lines. If you are using a tax provider that doesn't have TaxRates defined in the database,
 * you should apply the translations inside of your tax provider's `getTaxLines` method, using the `locale` provided in the context.
 *
 * @param taxLines - The tax lines to apply translations to.
 * @param locale - The locale to apply translations to.
 * @param container - The container to use for the translations.
 * @returns The tax lines with translations applied.
 */
const applyTranslationsToTaxLines = async (taxLines, locale, container) => {
    const translatedTaxRates = taxLines.map((taxLine) => ({
        id: taxLine.rate_id,
        name: taxLine.name,
    }));
    await (0, apply_translations_1.applyTranslations)({
        localeCode: locale,
        objects: translatedTaxRates,
        container,
    });
    const rateTranslationMap = new Map();
    for (const translatedRate of translatedTaxRates) {
        if (!!translatedRate.id) {
            rateTranslationMap.set(translatedRate.id, translatedRate.name);
        }
    }
    for (const taxLine of taxLines) {
        if (taxLine.rate_id) {
            taxLine.name = rateTranslationMap.get(taxLine.rate_id);
        }
    }
    return taxLines;
};
exports.applyTranslationsToTaxLines = applyTranslationsToTaxLines;
//# sourceMappingURL=apply-translations-to-tax-lines.js.map