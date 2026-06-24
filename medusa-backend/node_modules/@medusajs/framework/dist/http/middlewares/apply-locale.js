"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLocale = applyLocale;
const utils_1 = require("@medusajs/utils");
const CONTENT_LANGUAGE_HEADER = "x-medusa-locale";
/**
 * Middleware that resolves the locale for the current request.
 *
 * Resolution order:
 * 1. Query parameter `?locale=en-US`
 * 2. x-medusa-locale header
 *
 * The resolved locale is set on `req.locale`.
 */
async function applyLocale(req, _, next) {
    // 1. Check query parameter
    const queryLocale = req.query.locale;
    if (queryLocale) {
        req.locale = (0, utils_1.normalizeLocale)(queryLocale);
        delete req.query.locale;
        return next();
    }
    // 2. Check x-medusa-locale header
    const headerLocale = req.get(CONTENT_LANGUAGE_HEADER);
    if (headerLocale) {
        req.locale = (0, utils_1.normalizeLocale)(headerLocale);
        return next();
    }
    return next();
}
//# sourceMappingURL=apply-locale.js.map