"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTranslationsWorkflow = exports.createTranslationsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const emit_event_1 = require("../../common/steps/emit-event");
const steps_1 = require("../steps");
const utils_1 = require("@medusajs/framework/utils");
exports.createTranslationsWorkflowId = "create-translations";
/**
 * This workflow creates one or more translations. It's used by other workflows
 * like the {@link batchTranslationsWorkflow} workflow.
 *
 * You can use this workflow within your own customizations or custom workflows, allowing you
 * to create translations in your custom flows.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * const { result } = await createTranslationsWorkflow(container)
 * .run({
 *   input: {
 *     translations: [
 *       {
 *         reference_id: "prod_123",
 *         reference: "product",
 *         locale: "fr-FR",
 *         translations: { title: "Produit", description: "Description du produit" }
 *       }
 *     ]
 *   }
 * })
 *
 * @summary
 *
 * Create one or more translations.
 */
exports.createTranslationsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.createTranslationsWorkflowId, (input) => {
    const translations = (0, steps_1.createTranslationsStep)(input.translations);
    const translationIdEvents = (0, workflows_sdk_1.transform)({ translations }, ({ translations }) => {
        return translations.map((t) => {
            return { id: t.id };
        });
    });
    (0, emit_event_1.emitEventStep)({
        eventName: utils_1.TranslationWorkflowEvents.CREATED,
        data: translationIdEvents,
    });
    return new workflows_sdk_1.WorkflowResponse(translations);
});
//# sourceMappingURL=create-translations.js.map