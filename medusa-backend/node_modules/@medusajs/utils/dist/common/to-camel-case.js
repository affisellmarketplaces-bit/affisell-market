"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCamelCase = toCamelCase;
function toCamelCase(str) {
    return /^([a-zA-Z][a-zA-Z0-9]*)(([A-Z][a-z0-9]+)+)$/.test(str)
        ? str
        : str
            .toLowerCase()
            .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
}
//# sourceMappingURL=to-camel-case.js.map