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
var _RouteReloader_cacheManager, _RouteReloader_logSource, _RouteReloader_logger;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteReloader = void 0;
const types_1 = require("../types");
const base_1 = require("./base");
/**
 * Handles hot reloading of API resources (routes, middlewares, validators, etc.)
 */
class RouteReloader extends base_1.BaseReloader {
    constructor(apiLoader, cacheManager, logSource, logger) {
        super(cacheManager, logSource, logger);
        this.apiLoader = apiLoader;
        _RouteReloader_cacheManager.set(this, void 0);
        _RouteReloader_logSource.set(this, void 0);
        _RouteReloader_logger.set(this, void 0);
        __classPrivateFieldSet(this, _RouteReloader_cacheManager, cacheManager, "f");
        __classPrivateFieldSet(this, _RouteReloader_logSource, logSource, "f");
        __classPrivateFieldSet(this, _RouteReloader_logger, logger, "f");
    }
    /**
     * Check if a file path is in the API directory
     */
    isApiPath(filePath) {
        return filePath.includes(types_1.CONFIG.RESOURCE_PATH_PATTERNS.route);
    }
    /**
     * Reload ALL API resources when any API file changes
     * This clears all Express routes/middleware and reloads everything from scratch
     */
    async reload(_action, absoluteFilePath) {
        if (!this.isApiPath(absoluteFilePath)) {
            return;
        }
        if (!this.apiLoader) {
            __classPrivateFieldGet(this, _RouteReloader_logger, "f").error(`${__classPrivateFieldGet(this, _RouteReloader_logSource, "f")} ApiLoader not available - cannot reload API`);
            return;
        }
        __classPrivateFieldGet(this, _RouteReloader_logger, "f").info(`${__classPrivateFieldGet(this, _RouteReloader_logSource, "f")} API change detected: ${absoluteFilePath}`);
        await __classPrivateFieldGet(this, _RouteReloader_cacheManager, "f").clear(absoluteFilePath, __classPrivateFieldGet(this, _RouteReloader_logger, "f"), undefined, false // Don't track as broken since we're intentionally reloading
        );
        this.apiLoader.clearAllResources();
        await this.apiLoader.load();
        __classPrivateFieldGet(this, _RouteReloader_logger, "f").info(`${__classPrivateFieldGet(this, _RouteReloader_logSource, "f")} API resources reloaded successfully`);
    }
}
exports.RouteReloader = RouteReloader;
_RouteReloader_cacheManager = new WeakMap(), _RouteReloader_logSource = new WeakMap(), _RouteReloader_logger = new WeakMap();
//# sourceMappingURL=routes.js.map