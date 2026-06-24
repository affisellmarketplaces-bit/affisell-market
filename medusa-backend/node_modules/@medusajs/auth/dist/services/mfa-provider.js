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
var _AuthMfaProviderService_logger;
Object.defineProperty(exports, "__esModule", { value: true });
const _types_1 = require("../types");
class AuthMfaProviderService {
    constructor(container) {
        _AuthMfaProviderService_logger.set(this, void 0);
        this.dependencies = container;
        __classPrivateFieldSet(this, _AuthMfaProviderService_logger, container["logger"]
            ? container.logger
            : console, "f");
    }
    retrieveProviderRegistration(method) {
        try {
            return this.dependencies[`${_types_1.AuthMfaProviderRegistrationPrefix}${method}`];
        }
        catch (err) {
            if (err.name === "AwilixResolutionError") {
                const errMessage = `
Unable to retrieve the MFA method with id: ${method}
Please make sure that the method is registered in the container and it is configured correctly in your project configuration file.`;
                __classPrivateFieldGet(this, _AuthMfaProviderService_logger, "f").error(`AwilixResolutionError: ${err.message}`, err);
                throw new Error(errMessage);
            }
            const errMessage = `Unable to retrieve the MFA method with id: ${method}, the following error occurred: ${err.message}`;
            __classPrivateFieldGet(this, _AuthMfaProviderService_logger, "f").error(errMessage);
            throw new Error(errMessage);
        }
    }
    async canVerifyForAuthIdentity(method, data, sharedContext) {
        return await this.retrieveProviderRegistration(method).canVerifyForAuthIdentity(data, sharedContext);
    }
    async verify(method, data, sharedContext) {
        return await this.retrieveProviderRegistration(method).verify(data, sharedContext);
    }
    async start(method, data, sharedContext) {
        const provider = this.retrieveProviderRegistration(method);
        if (!this.isAuthMfaProvider_(provider)) {
            throw new Error(`MFA provider "${method}" does not support setup`);
        }
        return await provider.start(data, sharedContext);
    }
    async verifySetup(method, data, sharedContext) {
        const provider = this.retrieveProviderRegistration(method);
        if (!this.isAuthMfaProvider_(provider)) {
            throw new Error(`MFA provider "${method}" does not support setup verification`);
        }
        return await provider.verifySetup(data, sharedContext);
    }
    async generateCodes(method, data, sharedContext) {
        const provider = this.retrieveProviderRegistration(method);
        if (!this.isRecoveryCodeProvider_(provider)) {
            throw new Error(`MFA method "${method}" does not support recovery code generation`);
        }
        return await provider.generateCodes(data, sharedContext);
    }
    isAuthMfaProvider_(provider) {
        return "start" in provider && "verifySetup" in provider;
    }
    isRecoveryCodeProvider_(provider) {
        return "generateCodes" in provider;
    }
}
_AuthMfaProviderService_logger = new WeakMap();
exports.default = AuthMfaProviderService;
//# sourceMappingURL=mfa-provider.js.map