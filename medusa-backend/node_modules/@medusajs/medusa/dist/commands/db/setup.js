"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const loaders_1 = require("../../loaders");
const create_1 = require("./create");
const migrate_1 = require("./migrate");
const main = async function ({ directory, interactive, db, skipLinks, skipScripts, executeAllLinks, executeSafeLinks, }) {
    let container = await (0, loaders_1.initializeContainer)(directory, {
        skipDbConnection: true,
    });
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    try {
        const created = await (0, create_1.dbCreate)({ directory, interactive, db, logger });
        if (!created) {
            process.exit(1);
        }
        container = await (0, loaders_1.initializeContainer)(directory);
        const migrated = await (0, migrate_1.migrate)({
            directory,
            skipLinks,
            skipScripts,
            executeAllLinks,
            executeSafeLinks,
            logger,
            container,
        });
        process.exit(migrated ? 0 : 1);
    }
    catch (error) {
        if (error.name === "ExitPromptError") {
            process.exit();
        }
        logger.error(error);
        process.exit(1);
    }
};
exports.default = main;
//# sourceMappingURL=setup.js.map