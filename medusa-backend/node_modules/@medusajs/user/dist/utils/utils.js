"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpiresAt = getExpiresAt;
const timespan_1 = __importDefault(require("jsonwebtoken/lib/timespan"));
function getExpiresAt(expiresIn) {
    const expiresAt = typeof expiresIn === "number"
        ? new Date(Date.now() + expiresIn * 1000)
        : new Date(Math.floor((0, timespan_1.default)(expiresIn)) * 1000);
    return expiresAt;
}
//# sourceMappingURL=utils.js.map