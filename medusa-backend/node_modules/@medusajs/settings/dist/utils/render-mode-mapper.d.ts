/**
 * Render mode mapping utilities for column generation.
 * Maps field names and GraphQL types to appropriate render modes.
 */
/**
 * Common render mode type that can be extended by plugins.
 */
export type RenderMode = "text" | "number" | "currency" | "date" | "datetime" | "boolean" | "status" | "badge" | "badge_list" | "count" | "id" | "email" | "phone" | "url" | "image" | "json" | "country_code" | "address" | "customer_name" | "product_info" | "address_summary" | "sales_channels_list" | string;
/**
 * Infer the render mode from a field name and GraphQL type.
 */
export declare function inferRenderMode(fieldName: string, graphqlTypeName?: string): {
    renderMode: RenderMode;
    semanticType: string;
};
/**
 * Column data type as used in AdminColumn.
 */
export type ColumnDataType = "string" | "number" | "boolean" | "date" | "currency" | "enum" | "object";
/**
 * Map a data type to its default render mode.
 */
export declare function dataTypeToRenderMode(dataType: ColumnDataType): RenderMode;
/**
 * Infer the data type from a GraphQL scalar type name.
 */
export declare function inferDataType(graphqlTypeName: string, fieldName: string): ColumnDataType;
//# sourceMappingURL=render-mode-mapper.d.ts.map