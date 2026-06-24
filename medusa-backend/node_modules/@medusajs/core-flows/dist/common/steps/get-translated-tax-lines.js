"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTranslatedTaxLinesStep = exports.getTranslatedTaxLinesStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.getTranslatedTaxLinesStepId = "get-translated-tax-lines-step";
/**
 * This step retrieves translated tax lines for both item and shipping tax lines based on the provided locale.
 * It returns the translated tax lines in a structured format.
 *
 * @since 2.13.0
 *
 * @example
 * const translatedTaxLines = getTranslatedTaxLinesStep({
 *   itemTaxLines: [
 *     {
 *       line_item_id: "li_123",
 *       name: "VAT",
 *       // ...
 *     }
 *   ],
 *   shippingTaxLines: [
 *    {
 *       shipping_method_id: "sm_123",
 *       name: "GST",
 *       // ...
 *    }
 *  ],
 *  locale: "fr-FR"
 * })
 */
exports.getTranslatedTaxLinesStep = (0, workflows_sdk_1.createStep)(exports.getTranslatedTaxLinesStepId, async ({ itemTaxLines, shippingTaxLines, locale }, { container }) => {
    const isTranslationEnabled = utils_1.FeatureFlag.isFeatureEnabled("translation");
    if (!isTranslationEnabled) {
        return new workflows_sdk_1.StepResponse({
            itemTaxLines,
            shippingTaxLines,
        });
    }
    const [translatedItemTaxLines, translatedShippingTaxLines] = await Promise.all([
        (0, utils_1.applyTranslationsToTaxLines)(itemTaxLines, locale, container),
        (0, utils_1.applyTranslationsToTaxLines)(shippingTaxLines, locale, container),
    ]);
    return new workflows_sdk_1.StepResponse({
        itemTaxLines: translatedItemTaxLines,
        shippingTaxLines: translatedShippingTaxLines,
    });
});
//# sourceMappingURL=get-translated-tax-lines.js.map