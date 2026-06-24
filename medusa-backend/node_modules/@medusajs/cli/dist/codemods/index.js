"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCodemod = getCodemod;
exports.listCodemods = listCodemods;
const replace_zod_imports_1 = __importDefault(require("./replace-zod-imports"));
/**
 * Registry of available codemods
 */
const CODEMODS = {
    "replace-zod-imports": replace_zod_imports_1.default,
};
/**
 * Get a codemod by name
 * @param name - The name of the codemod to retrieve
 * @returns The codemod if found, null otherwise
 */
function getCodemod(name) {
    return CODEMODS[name] || null;
}
/**
 * List all available codemod names
 * @returns Array of codemod names
 */
function listCodemods() {
    return Object.keys(CODEMODS);
}
//# sourceMappingURL=index.js.map