"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exec;
const utils_1 = require("@medusajs/framework/utils");
const express_1 = __importDefault(require("express"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const loaders_1 = __importStar(require("../loaders"));
async function exec({ file, args }) {
    process.env.MEDUSA_WORKER_MODE = "server";
    const container = await (0, loaders_1.initializeContainer)(process.cwd(), {
        skipDbConnection: true,
    });
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    logger.info(`Executing script at ${file}...`);
    const app = (0, express_1.default)();
    const directory = process.cwd();
    try {
        // check if the file exists
        const filePath = path_1.default.resolve(directory, file);
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new Error(`File ${filePath} doesn't exist.`);
        }
        const scriptToExec = (await (0, utils_1.dynamicImport)(path_1.default.resolve(filePath))).default;
        if ((0, utils_1.isFileSkipped)(scriptToExec)) {
            throw new Error(`File is disabled.`);
        }
        if (!scriptToExec || typeof scriptToExec !== "function") {
            throw new Error(`File doesn't default export a function to execute.`);
        }
        const { container } = await (0, loaders_1.default)({
            directory,
            expressApp: app,
            skipLoadingEntryPoints: true,
        });
        const scriptParams = {
            container,
            args,
        };
        await scriptToExec(scriptParams);
        logger.info(`Finished executing script.`);
        process.exit();
    }
    catch (err) {
        logger.error("Error running script", err);
        process.exit(1);
    }
}
//# sourceMappingURL=exec.js.map