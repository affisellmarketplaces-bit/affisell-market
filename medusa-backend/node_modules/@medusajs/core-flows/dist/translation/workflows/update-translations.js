"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTranslationsWorkflow = exports.updateTranslationsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const emit_event_1 = require("../../common/steps/emit-event");
const steps_1 = require("../steps");
const utils_1 = require("@medusajs/framework/utils");
exports.updateTranslationsWorkflowId = "update-translations";
/**
 * This workflow updates translations matching the specified filters or IDs. It's used by other
 * workflows like the {@link batchTranslationsWorkflow} workflow.
 *
 * You can use this workflow within your own customizations or custom workflows, allowing you
 * to update translations in your custom flows.
 *
 * @since 2.12.3
 * @featureFlag translation
 *
 * @example
 * To update translations by their IDs:
 *
 * ```ts
 * const { result } = await updateTranslationsWorkflow(container)
 * .run({
 *   input: {
 *     translations: [
 *       { id: "trans_123", translations: { title: "Nouveau titre" } }
 *     ]
 *   }
 * })
 * ```
 *
 * To update translations matching filters:
 *
 * ```ts
 * const { result } = await updateTranslationsWorkflow(container)
 * .run({
 *   input: {
 *     selector: { reference_id: "prod_123", locale: "fr-FR" },
 *     update: { translations: { title: "Nouveau titre" } }
 *   }
 * })
 * ```
 *
 * @summary
 *
 * Update translations.
 */
exports.updateTranslationsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.updateTranslationsWorkflowId, (input) => {
    const translations = (0, steps_1.updateTranslationsStep)(input);
    const translationIdEvents = (0, workflows_sdk_1.transform)({ translations }, ({ translations }) => {
        return translations?.map((t) => {
            return { id: t.id };
        });
    });
    (0, emit_event_1.emitEventStep)({
        eventName: utils_1.TranslationWorkflowEvents.UPDATED,
        data: translationIdEvents,
    });
    return new workflows_sdk_1.WorkflowResponse(translations);
});
//# sourceMappingURL=update-translations.js.map