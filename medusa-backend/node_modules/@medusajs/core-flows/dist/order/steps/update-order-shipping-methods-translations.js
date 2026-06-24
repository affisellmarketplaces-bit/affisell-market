"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderShippingMethodsTranslationsStep = exports.updateOrderShippingMethodsTranslationsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.updateOrderShippingMethodsTranslationsStepId = "update-order-shipping-methods-translations";
/**
 * This step updates the names of order shipping methods based on the provided locale.
 * It fetches the translated names of the shipping option associated with each shipping method
 * and updates the shipping methods accordingly.
 *
 * @since 2.12.4
 *
 * @example
 * const updatedShippingMethods = updateOrderShippingMethodsTranslationsStep({
 *   shippingMethods: [
 *     {
 *       id: "sm_123",
 *       shipping_option_id: "so_123",
 *       name: "Standard Shipping",
 *       // ...
 *     }
 *   ],
 *   locale: "fr-FR"
 * })
 */
exports.updateOrderShippingMethodsTranslationsStep = (0, workflows_sdk_1.createStep)(exports.updateOrderShippingMethodsTranslationsStepId, async (data, { container }) => {
    const isTranslationEnabled = utils_1.FeatureFlag.isFeatureEnabled("translation");
    if (!isTranslationEnabled || !data.locale || !data.shippingMethods.length) {
        return new workflows_sdk_1.StepResponse(data.shippingMethods);
    }
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const orderModuleService = container.resolve(utils_1.Modules.ORDER);
    const { data: translatedShippingOptions } = await query.graph({
        entity: "shipping_option",
        fields: ["id", "name"],
        filters: {
            id: data.shippingMethods.map((sm) => sm.shipping_option_id),
        },
    }, {
        locale: data.locale,
    });
    const shippingOptionTranslationMap = new Map(translatedShippingOptions.map((tos) => [tos.id, tos.name]));
    const updatedShippingMethods = await orderModuleService.updateOrderShippingMethods(data.shippingMethods.map((sm) => ({
        ...sm,
        name: sm.shipping_option_id
            ? shippingOptionTranslationMap.get(sm.shipping_option_id)
            : sm.name,
    })));
    return new workflows_sdk_1.StepResponse(updatedShippingMethods, data.shippingMethods);
}, async (dataBeforeUpdate, { container }) => {
    if (!dataBeforeUpdate?.length) {
        return;
    }
    const orderModuleService = container.resolve(utils_1.Modules.ORDER);
    await orderModuleService.updateOrderShippingMethods(dataBeforeUpdate);
});
//# sourceMappingURL=update-order-shipping-methods-translations.js.map