"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTranslationsStep = exports.validateTranslationsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
exports.validateTranslationsStepId = "validate-translations";
/**
 * This step validates that the translations are supported by the store.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * const data = validateTranslationsStep([
 *   {
 *     reference_id: "prod_123",
 *     reference: "product",
 *     locale: "fr-FR",
 *     translations: { title: "Produit", description: "Description du produit" }
 *   }
 * ])
 *
 * @privateRemarks
 * TODO: Do we want to validate anything else here?
 */
exports.validateTranslationsStep = (0, workflows_sdk_1.createStep)(exports.validateTranslationsStepId, async (data, { container }) => {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: [store], } = await query.graph({
        entity: "store",
        fields: ["id", "supported_locales.*"],
        pagination: {
            take: 1,
        },
    }, {
        cache: { enable: true },
    });
    const enabledLocales = (store.supported_locales ?? []).map((locale) => locale.locale_code);
    const normalizedInput = Array.isArray(data) ? data : [data];
    const unsupportedLocales = normalizedInput
        .filter((translation) => Boolean(translation.locale_code))
        .map((translation) => translation.locale_code)
        .filter((locale) => !enabledLocales.includes(locale));
    if (unsupportedLocales.length) {
        throw new utils_1.MedusaError(utils_1.MedusaErrorTypes.INVALID_DATA, `The following locales are not supported in the store: ${unsupportedLocales.join(", ")}`);
    }
    return new workflows_sdk_1.StepResponse(void 0);
});
//# sourceMappingURL=validate-translations.js.map