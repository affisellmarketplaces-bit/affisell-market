"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTranslatedShippingOptionsStep = exports.getTranslatedShippingOptionsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.getTranslatedShippingOptionsStepId = "get-translated-shipping-options";
/**
 * This step applies translations to a list of shipping options based on the provided locale.
 * It modifies the shipping options in place and returns them.
 *
 * @since 2.12.4
 *
 * @example
 * const translatedShippingOptions = getTranslatedShippingOptionsStep({
 *   shippingOptions: [
 *     {
 *       id: "so_123",
 *       name: "Standard Shipping",
 *       // ...
 *     }
 *   ],
 *   locale: "fr-FR"
 * })
 */
exports.getTranslatedShippingOptionsStep = (0, workflows_sdk_1.createStep)(exports.getTranslatedShippingOptionsStepId, async (data, { container }) => {
    await (0, utils_1.applyTranslations)({
        localeCode: data.locale,
        objects: data.shippingOptions,
        container,
    });
    return new workflows_sdk_1.StepResponse(data.shippingOptions);
});
//# sourceMappingURL=get-translated-shipping-option.js.map