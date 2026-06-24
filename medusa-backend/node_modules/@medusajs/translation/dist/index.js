"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSLATION_MODULE = void 0;
require("./types");
const utils_1 = require("@medusajs/framework/utils");
const translation_module_1 = __importDefault(require("./services/translation-module"));
const defaults_1 = __importDefault(require("./loaders/defaults"));
exports.TRANSLATION_MODULE = "translation";
exports.default = (0, utils_1.Module)(exports.TRANSLATION_MODULE, {
    service: translation_module_1.default,
    loaders: [defaults_1.default],
});
//# sourceMappingURL=index.js.map