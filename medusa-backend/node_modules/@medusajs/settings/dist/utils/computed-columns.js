"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputedColumnRegistry = exports.BUILTIN_COMPUTED_COLUMNS = void 0;
exports.getComputedColumnRegistry = getComputedColumnRegistry;
/**
 * Built-in computed columns migrated from entity-mappings.ts.
 */
exports.BUILTIN_COMPUTED_COLUMNS = [
    // Order computed columns
    {
        id: "customer_display",
        name: "Customer",
        renderMode: "customer_name",
        requiredFields: [
            "customer.first_name",
            "customer.last_name",
            "customer.email",
        ],
        optionalFields: ["customer.phone"],
        entities: ["Order"],
        defaultVisible: true,
        description: "Customer name and contact information",
        category: "relationship",
    },
    {
        id: "shipping_address_display",
        name: "Shipping Address",
        renderMode: "address_summary",
        requiredFields: [
            "shipping_address.city",
            "shipping_address.country_code",
        ],
        optionalFields: [
            "shipping_address.address_1",
            "shipping_address.province",
            "shipping_address.postal_code",
        ],
        entities: ["Order"],
        defaultVisible: false,
        description: "Shipping address summary",
        category: "relationship",
    },
    {
        id: "billing_address_display",
        name: "Billing Address",
        renderMode: "address_summary",
        requiredFields: [
            "billing_address.city",
            "billing_address.country_code",
        ],
        optionalFields: [
            "billing_address.address_1",
            "billing_address.province",
            "billing_address.postal_code",
        ],
        entities: ["Order"],
        defaultVisible: false,
        description: "Billing address summary",
        category: "relationship",
    },
    {
        id: "country",
        name: "Country",
        renderMode: "country_code",
        requiredFields: ["shipping_address.country_code"],
        optionalFields: [],
        entities: ["Order"],
        defaultVisible: true,
        description: "Shipping country",
        category: "metadata",
    },
    // Product computed columns
    {
        id: "product_display",
        name: "Product",
        renderMode: "product_info",
        requiredFields: ["title", "thumbnail"],
        optionalFields: ["handle"],
        entities: ["Product"],
        defaultVisible: true,
        description: "Product title and thumbnail",
        category: "computed",
    },
    {
        id: "variants_count",
        name: "Variants",
        renderMode: "count",
        requiredFields: ["variants"],
        optionalFields: [],
        entities: ["Product"],
        defaultVisible: true,
        description: "Number of product variants",
        category: "metric",
    },
    {
        id: "sales_channels_display",
        name: "Sales Channels",
        renderMode: "sales_channels_list",
        requiredFields: ["sales_channels"],
        optionalFields: [],
        entities: ["Product"],
        defaultVisible: true,
        description: "Sales channels the product is available in",
        category: "relationship",
    },
];
/**
 * Registry for computed columns.
 * Allows registration of custom computed columns.
 */
class ComputedColumnRegistry {
    constructor() {
        this.columns = new Map();
        // Register built-in columns
        for (const column of exports.BUILTIN_COMPUTED_COLUMNS) {
            this.register(column);
        }
    }
    /**
     * Register a computed column.
     */
    register(column) {
        this.columns.set(column.id, column);
    }
    /**
     * Get a computed column by ID.
     */
    get(id) {
        return this.columns.get(id);
    }
    /**
     * Get all computed columns for an entity.
     */
    getForEntity(entityName) {
        const result = [];
        for (const column of this.columns.values()) {
            if (column.entities.includes(entityName)) {
                result.push(column);
            }
        }
        return result;
    }
    /**
     * Get all registered computed columns.
     */
    getAll() {
        return Array.from(this.columns.values());
    }
    /**
     * Check if a computed column exists.
     */
    has(id) {
        return this.columns.has(id);
    }
}
exports.ComputedColumnRegistry = ComputedColumnRegistry;
// Singleton instance
let registryInstance = null;
/**
 * Get the computed column registry singleton.
 */
function getComputedColumnRegistry() {
    if (!registryInstance) {
        registryInstance = new ComputedColumnRegistry();
    }
    return registryInstance;
}
//# sourceMappingURL=computed-columns.js.map