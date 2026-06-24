"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HMRReloadError = void 0;
class HMRReloadError extends Error {
    static isHMRReloadError(error) {
        return error instanceof HMRReloadError || error.name === "HMRReloadError";
    }
    constructor(message) {
        super(message);
        this.name = "HMRReloadError";
    }
}
exports.HMRReloadError = HMRReloadError;
//# sourceMappingURL=errors.js.map