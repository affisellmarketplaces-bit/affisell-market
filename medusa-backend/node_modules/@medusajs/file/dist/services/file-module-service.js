"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const joiner_config_1 = require("../joiner-config");
class FileModuleService {
    constructor({ fileProviderService }) {
        this.fileProviderService_ = fileProviderService;
    }
    __joinerConfig() {
        return joiner_config_1.joinerConfig;
    }
    getProvider() {
        return this.fileProviderService_;
    }
    async createFiles(data) {
        const input = Array.isArray(data) ? data : [data];
        // TODO: Validate file mime type, have config for allowed types
        const files = await Promise.all(input.map((file) => this.fileProviderService_.upload(file)));
        const result = files.map((file) => ({
            id: file.key,
            url: file.url,
        }));
        return Array.isArray(data) ? result : result[0];
    }
    async getUploadFileUrls(data) {
        const input = Array.isArray(data) ? data : [data];
        const result = await Promise.all(input.map((file) => this.fileProviderService_.getPresignedUploadUrl(file)));
        return Array.isArray(data) ? result : result[0];
    }
    async deleteFiles(ids) {
        const input = Array.isArray(ids) ? ids : [ids];
        await this.fileProviderService_.delete(input.map((id) => {
            return { fileKey: id };
        }));
    }
    async retrieveFile(id) {
        const res = await this.fileProviderService_.getPresignedDownloadUrl({
            fileKey: id,
        });
        return {
            id,
            url: res,
        };
    }
    async listFiles(filters, config, sharedContext) {
        if (!filters?.id) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Listing of files is only supported when filtering by ID.");
        }
        const ids = Array.isArray(filters?.id) ? filters?.id : [filters?.id];
        const res = await Promise.all(ids.map(async (id) => {
            const res = await this.fileProviderService_.getPresignedDownloadUrl({
                fileKey: id,
            });
            return { id, url: res };
        }));
        return res;
    }
    async listAndCountFiles(filters, config, sharedContext) {
        if (!filters?.id) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "Listing of files is only supported when filtering by ID.");
        }
        const ids = Array.isArray(filters?.id) ? filters?.id : [filters?.id];
        const res = await Promise.all(ids.map(async (id) => {
            const res = await this.fileProviderService_.getPresignedDownloadUrl({
                fileKey: id,
            });
            return { id, url: res };
        }));
        return [res, res.length];
    }
    /**
     * Get the file contents as a readable stream.
     *
     * @example
     * const stream = await fileModuleService.getAsStream("file_123")
     * writeable.pipe(stream)
     */
    getDownloadStream(id) {
        return this.fileProviderService_.getDownloadStream({ fileKey: id });
    }
    /**
     * Get the file contents as a Node.js Buffer
     *
     * @example
     * const contents = await fileModuleService.getAsBuffer("file_123")
     * contents.toString('utf-8')
     */
    getAsBuffer(id) {
        return this.fileProviderService_.getAsBuffer({ fileKey: id });
    }
    /**
     * Get a writeable stream to upload a file.
     *
     * @example
     * const { writeStream, promise } = await fileModuleService.getUploadStream({
     *   filename: "test.csv",
     *   mimeType: "text/csv",
     * })
     *
     * stream.pipe(writeStream)
     * const result = await promise
     */
    getUploadStream(data) {
        return this.fileProviderService_.getUploadStream(data);
    }
}
exports.default = FileModuleService;
//# sourceMappingURL=file-module-service.js.map