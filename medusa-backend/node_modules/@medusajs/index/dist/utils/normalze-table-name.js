"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTableName = normalizeTableName;
exports.getPivotTableName = getPivotTableName;
const utils_1 = require("@medusajs/framework/utils");
function normalizeTableName(name) {
    return (0, utils_1.compressName)(name.toLowerCase(), 58).replace(/[^a-z0-9_]/g, "_");
}
function getPivotTableName(tableName) {
    const compressedName = normalizeTableName(tableName);
    return `cat_pivot_${compressedName}`;
}
//# sourceMappingURL=normalze-table-name.js.map