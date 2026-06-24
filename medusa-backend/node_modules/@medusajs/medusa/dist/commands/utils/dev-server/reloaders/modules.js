"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ModuleReloader_logSource, _ModuleReloader_logger, _ModuleReloader_rootDirectory;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleReloader = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const path_1 = require("path");
const types_1 = require("../types");
const base_1 = require("./base");
const errors_1 = require("../errors");
/**
 * Handles hot reloading of custom modules in the /modules directory
 */
class ModuleReloader extends base_1.BaseReloader {
    constructor(cacheManager, rootDirectory, logSource, logger) {
        super(cacheManager, logSource, logger);
        _ModuleReloader_logSource.set(this, void 0);
        _ModuleReloader_logger.set(this, void 0);
        _ModuleReloader_rootDirectory.set(this, void 0);
        __classPrivateFieldSet(this, _ModuleReloader_logSource, logSource, "f");
        __classPrivateFieldSet(this, _ModuleReloader_logger, logger, "f");
        __classPrivateFieldSet(this, _ModuleReloader_rootDirectory, rootDirectory, "f");
    }
    /**
     * Check if a file path is within a module directory
     */
    isModulePath(filePath) {
        return filePath.includes("modules/");
    }
    /**
     * Extract module name from file path
     * e.g., "/path/to/project/modules/contact-us/service.ts" -> "contact-us"
     */
    getModuleNameFromPath(filePath) {
        const modulesPattern = "modules/";
        const parts = filePath.split(modulesPattern);
        if (parts.length < 2) {
            return null;
        }
        const afterModules = parts[1];
        const moduleName = afterModules.split("/")[0];
        return moduleName || null;
    }
    /**
     * Get the module directory path
     */
    getModuleDirectory(moduleName) {
        return (0, path_1.join)(__classPrivateFieldGet(this, _ModuleReloader_rootDirectory, "f"), "src", "modules", moduleName);
    }
    /**
     * Get module key and service name from config
     */
    async getModuleInfo(moduleName) {
        try {
            const configModule = framework_1.container.resolve(utils_1.ContainerRegistrationKeys.CONFIG_MODULE);
            if (!configModule?.modules) {
                return null;
            }
            // Find the module in config
            for (const [key, config] of Object.entries(configModule.modules)) {
                if (typeof config === "object" && config !== null) {
                    const resolvedPath = config.resolve;
                    if (resolvedPath &&
                        (resolvedPath.includes(`/modules/${moduleName}`) ||
                            resolvedPath === `./modules/${moduleName}`)) {
                        // Load the module to get serviceName from joinerConfig
                        const moduleDirectory = this.getModuleDirectory(moduleName);
                        const moduleIndexPath = (0, path_1.join)(moduleDirectory, "index.ts");
                        const moduleExports = await (0, utils_1.dynamicImport)(moduleIndexPath);
                        const moduleService = moduleExports.service ?? moduleExports.default?.service;
                        const joinerConfig = typeof moduleService?.prototype?.__joinerConfig === "function"
                            ? moduleService.prototype.__joinerConfig()
                            : moduleService?.prototype?.__joinerConfig;
                        if (!joinerConfig?.serviceName) {
                            return null;
                        }
                        return {
                            moduleKey: key,
                            serviceName: joinerConfig.serviceName,
                        };
                    }
                }
            }
            return null;
        }
        catch (error) {
            __classPrivateFieldGet(this, _ModuleReloader_logger, "f").warn(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Failed to get module info for "${moduleName}": ${error.message}`);
            return null;
        }
    }
    /**
     * Shutdown a module instance by calling its lifecycle hooks
     */
    async shutdownModule(moduleInstance) {
        try {
            if (moduleInstance?.__hooks?.onApplicationPrepareShutdown) {
                await moduleInstance.__hooks.onApplicationPrepareShutdown
                    .bind(moduleInstance)()
                    .catch(() => { });
            }
            if (moduleInstance?.__hooks?.onApplicationShutdown) {
                await moduleInstance.__hooks.onApplicationShutdown
                    .bind(moduleInstance)()
                    .catch(() => { });
            }
        }
        catch (error) {
            __classPrivateFieldGet(this, _ModuleReloader_logger, "f").warn(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Error during module shutdown: ${error.message}`);
        }
    }
    /**
     * Clear all module files from require cache
     */
    clearModuleFilesCache(moduleDirectory) {
        const relativeModuleDirectory = (0, path_1.relative)(__classPrivateFieldGet(this, _ModuleReloader_rootDirectory, "f"), moduleDirectory);
        Object.keys(require.cache).forEach((cachedPath) => {
            if (!types_1.CONFIG.EXCLUDED_PATH_PATTERNS.some((pattern) => cachedPath.includes(pattern)) &&
                cachedPath.includes(relativeModuleDirectory)) {
                delete require.cache[cachedPath];
            }
        });
    }
    /**
     * Reload a module when its files change
     */
    async reload(action, absoluteFilePath) {
        if (!this.isModulePath(absoluteFilePath)) {
            return;
        }
        const moduleName = this.getModuleNameFromPath(absoluteFilePath);
        if (!moduleName) {
            __classPrivateFieldGet(this, _ModuleReloader_logger, "f").warn(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Could not determine module name from path: ${absoluteFilePath}`);
            return;
        }
        const relativePath = (0, path_1.relative)(__classPrivateFieldGet(this, _ModuleReloader_rootDirectory, "f"), absoluteFilePath);
        if (action === "unlink") {
            __classPrivateFieldGet(this, _ModuleReloader_logger, "f").warn(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Module file removed: ${relativePath}. Server restart may be required.`);
            throw new errors_1.HMRReloadError(`Module file removed: ${relativePath}. Server restart may be required.`);
        }
        if (absoluteFilePath.includes("migrations")) {
            __classPrivateFieldGet(this, _ModuleReloader_logger, "f").warn(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Migrations file changed: ${relativePath}. You may need to apply migrations and restart the server.`);
            return;
        }
        // Get the module information
        const moduleInfo = await this.getModuleInfo(moduleName);
        if (!moduleInfo) {
            __classPrivateFieldGet(this, _ModuleReloader_logger, "f").warn(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Could not find module config for: ${moduleName}`);
            return;
        }
        const { moduleKey, serviceName } = moduleInfo;
        __classPrivateFieldGet(this, _ModuleReloader_logger, "f").info(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Reloading module "${serviceName}" (${moduleName}) due to change in ${relativePath}`);
        try {
            // Get the current module instance
            const moduleInstance = framework_1.container.resolve(serviceName);
            if (moduleInstance) {
                // Shutdown the module
                await this.shutdownModule(moduleInstance);
            }
            const moduleDirectory = this.getModuleDirectory(moduleName);
            this.clearModuleFilesCache(moduleDirectory);
            const medusaAppLoader = new framework_1.MedusaAppLoader();
            const newModuleInstance = (await medusaAppLoader.reloadSingleModule({
                moduleKey,
                serviceName,
            }));
            if (!newModuleInstance) {
                throw new Error(`Failed to reload module "${moduleKey}"`);
            }
            __classPrivateFieldGet(this, _ModuleReloader_logger, "f").info(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Successfully reloaded module "${serviceName}"`);
        }
        catch (error) {
            __classPrivateFieldGet(this, _ModuleReloader_logger, "f").error(`${__classPrivateFieldGet(this, _ModuleReloader_logSource, "f")} Failed to reload module "${serviceName}": ${error.message}`);
            throw new errors_1.HMRReloadError(`Failed to reload module "${serviceName}": ${error.message}. Server restart may be required.`);
        }
    }
}
exports.ModuleReloader = ModuleReloader;
_ModuleReloader_logSource = new WeakMap(), _ModuleReloader_logger = new WeakMap(), _ModuleReloader_rootDirectory = new WeakMap();
//# sourceMappingURL=modules.js.map