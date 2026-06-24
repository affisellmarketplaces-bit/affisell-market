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
var _CacheProviderService_container, _CacheProviderService_logger;
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const types_1 = require("../types");
class CacheProviderService {
    constructor(container) {
        _CacheProviderService_container.set(this, void 0);
        _CacheProviderService_logger.set(this, void 0);
        __classPrivateFieldSet(this, _CacheProviderService_container, container, "f");
        __classPrivateFieldSet(this, _CacheProviderService_logger, container["logger"]
            ? container.logger
            : console, "f");
    }
    static getRegistrationIdentifier(providerClass) {
        if (!providerClass.identifier) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_ARGUMENT, `Trying to register a caching provider without an identifier.`);
        }
        return `${providerClass.identifier}`;
    }
    retrieveProvider(providerId) {
        try {
            return __classPrivateFieldGet(this, _CacheProviderService_container, "f")[`${types_1.CachingProviderRegistrationPrefix}${providerId}`];
        }
        catch (err) {
            if (err.name === "AwilixResolutionError") {
                const errMessage = `
 Unable to retrieve the caching provider with id: ${providerId}
Please make sure that the provider is registered in the container and it is configured correctly in your project configuration file.`;
                // Log full error for debugging
                __classPrivateFieldGet(this, _CacheProviderService_logger, "f").error(`AwilixResolutionError: ${err.message}`, err);
                throw new Error(errMessage);
            }
            const errMessage = `Unable to retrieve the caching provider with id: ${providerId}, the following error occurred: ${err.message}`;
            __classPrivateFieldGet(this, _CacheProviderService_logger, "f").error(errMessage);
            throw new Error(errMessage);
        }
    }
}
_CacheProviderService_container = new WeakMap(), _CacheProviderService_logger = new WeakMap();
exports.default = CacheProviderService;
//# sourceMappingURL=cache-provider.js.map