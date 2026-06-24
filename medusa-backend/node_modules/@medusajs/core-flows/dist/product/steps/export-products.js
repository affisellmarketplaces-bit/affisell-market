"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportProductsStep = exports.exportProductsStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const normalize_for_export_1 = require("../helpers/normalize-for-export");
const json_2_csv_1 = require("json-2-csv");
/**
 * The step ID for exporting products.
 */
exports.exportProductsStepId = "export-products";
const DEFAULT_BATCH_SIZE = 50;
/**
 * This step exports products to a CSV file based on the provided filters.
 *
 * @example
 * To export all products:
 *
 * ```ts
 * const data = exportProductsStep({
 *   select: ["id", "title", "handle"],
 *   batch_size: 100
 * })
 * ```
 *
 * To export products from a specific sales channel:
 *
 * ```ts
 * const data = exportProductsStep({
 *   select: ["id", "title", "handle"],
 *   filter: {
 *     sales_channel_id: "sc_123"
 *   }
 * })
 * ```
 */
exports.exportProductsStep = (0, workflows_sdk_1.createStep)(exports.exportProductsStepId, async (input, { container }) => {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const fileModule = container.resolve(utils_1.Modules.FILE);
    const regionModule = container.resolve(utils_1.Modules.REGION);
    const regions = await regionModule.listRegions({}, { select: ["id", "name", "currency_code"] });
    const filename = `${Date.now()}-product-exports.csv`;
    const { writeStream, promise, fileKey } = await fileModule.getUploadStream({
        filename,
        mimeType: "text/csv",
    });
    const pageSize = !isNaN(parseInt(input?.batch_size))
        ? parseInt(input?.batch_size, 10)
        : DEFAULT_BATCH_SIZE;
    let page = 0;
    let hasHeader = false;
    const fields = (0, utils_1.deduplicate)(["id", "handle", ...input.select]);
    const { sales_channel_id, ..._filters } = input.filter ?? {};
    while (true) {
        if (!!sales_channel_id) {
            const { data: salesChannelProducts } = await query.graph({
                entity: "product_sales_channel",
                filters: {
                    sales_channel_id,
                },
                fields: ["product_id"],
                pagination: {
                    skip: page * pageSize,
                    take: pageSize,
                },
            });
            _filters.id = salesChannelProducts.map((product) => product.product_id);
        }
        const { data: products } = await query.graph({
            entity: "product",
            fields,
            filters: _filters,
            // If sales channel is specified, we already paginated
            pagination: sales_channel_id
                ? undefined
                : {
                    skip: page * pageSize,
                    take: pageSize,
                },
        });
        if (products.length === 0) {
            break;
        }
        const normalizedProducts = (0, normalize_for_export_1.normalizeForExport)(products, { regions });
        const batchCsv = (0, json_2_csv_1.json2csv)(normalizedProducts, {
            prependHeader: !hasHeader,
            arrayIndexesAsKeys: true,
            expandNestedObjects: true,
            expandArrayObjects: true,
            unwindArrays: false,
            preventCsvInjection: true,
            emptyFieldValue: "",
        });
        const ok = writeStream.write((hasHeader ? "\n" : "") + batchCsv);
        if (!ok) {
            await new Promise((resolve) => writeStream.once("drain", resolve));
        }
        hasHeader = true;
        if (products.length < pageSize) {
            break;
        }
        page += 1;
    }
    writeStream.end();
    await promise;
    return new workflows_sdk_1.StepResponse({ id: fileKey, filename }, fileKey);
}, async (fileId, { container }) => {
    if (!fileId) {
        return;
    }
    const fileModule = container.resolve(utils_1.Modules.FILE);
    await fileModule.deleteFiles(fileId);
});
//# sourceMappingURL=export-products.js.map