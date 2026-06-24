"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldParser = void 0;
const utils_1 = require("@medusajs/utils");
/**
 * Handles parsing of field strings into structured field sets
 * Supports various field modifiers:
 * - `+field` or ` field`: Add to defaults
 * - `-field`: Remove from defaults
 * - `*field` or `field.*`: Select all properties of a relation
 */
class FieldParser {
    /**
     * Parse field string and defaults into structured field sets
     * @param fields - Comma-separated field string from query
     * @param defaults - Default fields to include
     * @returns ParsedFields with fields and starFields sets
     */
    static parse(fields, defaults = []) {
        const starFields = new Set();
        let allFields = new Set(defaults);
        if ((0, utils_1.isDefined)(fields)) {
            const customFields = fields.split(",").filter(Boolean);
            const shouldReplaceDefaultFields = this.shouldReplaceDefaults(customFields);
            if (shouldReplaceDefaultFields) {
                allFields = new Set(customFields.map((f) => f.replace(/^[+ -]/, "")));
            }
            else {
                this.applyFieldModifiers(customFields, allFields);
            }
            allFields.add("id");
        }
        this.extractStarFields(allFields, starFields);
        return { fields: allFields, starFields };
    }
    /**
     * Determines if custom fields should replace defaults
     * Fields replace defaults when any field doesn't have a modifier prefix
     */
    static shouldReplaceDefaults(customFields) {
        return (!customFields.length ||
            customFields.some((field) => {
                return !(field.startsWith("-") ||
                    field.startsWith("+") ||
                    field.startsWith(" ") ||
                    field.startsWith("*") ||
                    field.endsWith(".*"));
            }));
    }
    /**
     * Apply field modifiers (+, -, etc) to the field set
     */
    static applyFieldModifiers(customFields, allFields) {
        customFields.forEach((field) => {
            if (field.startsWith("+") || field.startsWith(" ")) {
                allFields.add(field.trim().replace(/^\+/, ""));
            }
            else if (field.startsWith("-")) {
                const fieldName = field.replace(/^-/, "");
                for (const reqField of allFields) {
                    const reqFieldName = reqField.replace(/^\*/, "");
                    if (reqFieldName === fieldName ||
                        reqFieldName.startsWith(fieldName + ".")) {
                        allFields.delete(reqField);
                    }
                }
            }
            else {
                allFields.add(field);
            }
        });
    }
    /**
     * Extract star fields (* prefix or .* suffix) from allFields into starFields set
     * Star fields represent "select all properties" for a relation
     */
    static extractStarFields(allFields, starFields) {
        allFields.forEach((field) => {
            if (field.startsWith("*") || field.endsWith(".*")) {
                starFields.add(field.replace(/(^\*|\.\*$)/, ""));
                allFields.delete(field);
            }
        });
    }
}
exports.FieldParser = FieldParser;
//# sourceMappingURL=field-parser.js.map