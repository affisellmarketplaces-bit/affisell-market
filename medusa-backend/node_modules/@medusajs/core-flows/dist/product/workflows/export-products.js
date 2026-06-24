"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportProductsWorkflow = exports.exportProductsWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
const common_1 = require("../../common");
const notification_1 = require("../../notification");
exports.exportProductsWorkflowId = "export-products";
/**
 * This workflow exports products matching the specified filters. It's used by the
 * [Export Products Admin API Route](https://docs.medusajs.com/api/admin#products_postproductsexport).
 *
 * :::note
 *
 * This workflow doesn't return the exported products. Instead, it sends a notification to the admin
 * users that they can download the exported products. Learn more in the [API Reference](https://docs.medusajs.com/api/admin#products_postproductsexport).
 *
 * :::
 *
 * @example
 * To export all products:
 *
 * ```ts
 * const { result } = await exportProductsWorkflow(container)
 * .run({
 *   input: {
 *     select: ["*"],
 *   }
 * })
 * ```
 *
 * To export products matching a criteria:
 *
 * ```ts
 * const { result } = await exportProductsWorkflow(container)
 * .run({
 *   input: {
 *     select: ["*"],
 *     filter: {
 *       collection_id: "pcol_123"
 *     }
 *   }
 * })
 * ```
 *
 * @summary
 *
 * Export products with filtering capabilities.
 */
exports.exportProductsWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.exportProductsWorkflowId, (input) => {
    const file = (0, steps_1.exportProductsStep)(input).config({
        async: true,
        backgroundExecution: true,
    });
    const failureNotification = (0, workflows_sdk_1.transform)({ input }, (data) => {
        return [
            {
                // We don't need the recipient here for now, but if we want to push feed notifications to a specific user we could add it.
                to: "",
                channel: "feed",
                template: "admin-ui",
                data: {
                    title: "Product export",
                    description: `Failed to export products, please try again later.`,
                },
            },
        ];
    });
    (0, notification_1.notifyOnFailureStep)(failureNotification);
    const { data: fileDetails } = (0, common_1.useQueryGraphStep)({
        entity: "file",
        fields: ["id", "url"],
        filters: { id: file.id },
        options: { isList: false },
    });
    const notifications = (0, workflows_sdk_1.transform)({ fileDetails, file }, (data) => {
        return [
            {
                // We don't need the recipient here for now, but if we want to push feed notifications to a specific user we could add it.
                to: "",
                channel: "feed",
                template: "admin-ui",
                data: {
                    title: "Product export",
                    description: "Product export completed successfully!",
                    file: {
                        filename: data.file.filename,
                        url: data.fileDetails.url,
                        mimeType: "text/csv",
                    },
                },
            },
        ];
    });
    (0, notification_1.sendNotificationsStep)(notifications);
});
//# sourceMappingURL=export-products.js.map