"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDbExists = ensureDbExists;
exports.isPgstreamEnabled = isPgstreamEnabled;
const utils_1 = require("@medusajs/framework/utils");
async function ensureDbExists(container) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const pgConnection = container.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION);
    try {
        await pgConnection.raw("SELECT 1 + 1;");
    }
    catch (error) {
        if (error.code === "3D000") {
            logger.error(`Cannot sync links. ${error.message.replace("error: ", "")}`);
            logger.info(`Run command "db:create" to create the database`);
        }
        else {
            logger.error(error);
        }
        process.exit(1);
    }
}
async function isPgstreamEnabled(container) {
    const pgConnection = container.resolve(utils_1.ContainerRegistrationKeys.PG_CONNECTION);
    try {
        const result = await pgConnection.raw("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pgstream'");
        return result.rows.length > 0;
    }
    catch (error) {
        // If there's an error checking, assume pgstream is not enabled
        return false;
    }
}
//# sourceMappingURL=index.js.map