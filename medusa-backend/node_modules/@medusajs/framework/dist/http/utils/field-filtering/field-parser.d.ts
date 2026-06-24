import { ParsedFields } from "./index";
/**
 * Handles parsing of field strings into structured field sets
 * Supports various field modifiers:
 * - `+field` or ` field`: Add to defaults
 * - `-field`: Remove from defaults
 * - `*field` or `field.*`: Select all properties of a relation
 */
export declare class FieldParser {
    /**
     * Parse field string and defaults into structured field sets
     * @param fields - Comma-separated field string from query
     * @param defaults - Default fields to include
     * @returns ParsedFields with fields and starFields sets
     */
    static parse(fields: string | undefined, defaults?: string[]): ParsedFields;
    /**
     * Determines if custom fields should replace defaults
     * Fields replace defaults when any field doesn't have a modifier prefix
     */
    private static shouldReplaceDefaults;
    /**
     * Apply field modifiers (+, -, etc) to the field set
     */
    private static applyFieldModifiers;
    /**
     * Extract star fields (* prefix or .* suffix) from allFields into starFields set
     * Star fields represent "select all properties" for a relation
     */
    private static extractStarFields;
}
//# sourceMappingURL=field-parser.d.ts.map