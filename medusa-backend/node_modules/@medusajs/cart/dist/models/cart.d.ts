/**
 * Represents a shopping cart containing items and associated data.
 */
declare const Cart: import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
    /**
     * The unique identifier of the cart.
     */
    id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
    /**
     * The ID of the region the cart belongs to.
     */
    region_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    /**
     * The ID of the customer the cart belongs to.
     */
    customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    /**
     * The ID of the sales channel the cart is associated with.
     */
    sales_channel_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    /**
     * The email address associated with the cart.
     */
    email: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    /**
     * The currency code used for the cart.
     */
    currency_code: import("@medusajs/framework/utils").TextProperty;
    /**
     * The BCP 47 language tag code of the locale
     *
     * @since 2.12.3
     *
     * @example
     * "en-US"
     */
    locale: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
    /**
     * Additional metadata for the cart.
     */
    metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    /**
     * The timestamp when the cart was completed/converted to an order.
     */
    completed_at: import("@medusajs/framework/utils").NullableModifier<Date, import("@medusajs/framework/utils").DateTimeProperty>;
    /**
     * The shipping address for the cart.
     */
    shipping_address: import("@medusajs/framework/utils").RelationNullableModifier<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        company: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        first_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        last_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        address_1: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        address_2: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        city: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        country_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        province: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        postal_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        phone: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, {
        readonly tableName: "cart_address";
        readonly name: "Address";
    }>, import("@medusajs/framework/utils").HasOneWithForeignKey<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        company: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        first_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        last_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        address_1: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        address_2: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        city: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        country_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        province: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        postal_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        phone: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, {
        readonly tableName: "cart_address";
        readonly name: "Address";
    }>, undefined>, true>;
    /**
     * The billing address for the cart.
     */
    billing_address: import("@medusajs/framework/utils").RelationNullableModifier<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        company: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        first_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        last_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        address_1: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        address_2: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        city: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        country_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        province: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        postal_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        phone: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, {
        readonly tableName: "cart_address";
        readonly name: "Address";
    }>, import("@medusajs/framework/utils").HasOneWithForeignKey<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        customer_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        company: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        first_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        last_name: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        address_1: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        address_2: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        city: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        country_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        province: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        postal_code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        phone: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, {
        readonly tableName: "cart_address";
        readonly name: "Address";
    }>, undefined>, true>;
    /**
     * The line items in the cart.
     */
    items: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        title: import("@medusajs/framework/utils").TextProperty;
        subtitle: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        thumbnail: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        quantity: import("@medusajs/framework/utils").NumberProperty;
        variant_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_subtitle: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_type: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_type_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_collection: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        product_handle: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        variant_sku: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        variant_barcode: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        variant_title: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        variant_option_values: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        requires_shipping: import("@medusajs/framework/utils").BooleanProperty;
        is_discountable: import("@medusajs/framework/utils").BooleanProperty;
        is_giftcard: import("@medusajs/framework/utils").BooleanProperty;
        is_tax_inclusive: import("@medusajs/framework/utils").BooleanProperty;
        is_custom_price: import("@medusajs/framework/utils").BooleanProperty;
        compare_at_unit_price: import("@medusajs/framework/utils").NullableModifier<number, import("@medusajs/framework/utils").BigNumberProperty>;
        unit_price: import("@medusajs/framework/utils").BigNumberProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        original_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        original_subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        original_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        item_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        item_subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        item_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        discount_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        discount_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        adjustments: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            amount: import("@medusajs/framework/utils").BigNumberProperty;
            is_tax_inclusive: import("@medusajs/framework/utils").BooleanProperty;
            provider_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            promotion_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
            item: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, {
                readonly name: "LineItem";
                readonly tableName: "cart_line_item";
            }>, undefined>;
        }>, {
            readonly name: "LineItemAdjustment";
            readonly tableName: "cart_line_item_adjustment";
        }>>;
        tax_lines: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            code: import("@medusajs/framework/utils").TextProperty;
            rate: import("@medusajs/framework/utils").FloatProperty;
            provider_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
            tax_rate_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            item: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, {
                readonly name: "LineItem";
                readonly tableName: "cart_line_item";
            }>, undefined>;
        }>, {
            readonly name: "LineItemTaxLine";
            readonly tableName: "cart_line_item_tax_line";
        }>>;
        cart: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "Cart">, undefined>;
    }>, {
        readonly name: "LineItem";
        readonly tableName: "cart_line_item";
    }>>;
    /**
     * The credit lines associated with the cart.
     */
    credit_lines: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        cart: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "Cart">, undefined>;
        reference: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        reference_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        amount: import("@medusajs/framework/utils").BigNumberProperty;
        raw_amount: import("@medusajs/framework/utils").JSONProperty;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
    }>, "CreditLine">>;
    /**
     * The shipping methods selected for the cart.
     */
    shipping_methods: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
        id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
        name: import("@medusajs/framework/utils").TextProperty;
        description: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        amount: import("@medusajs/framework/utils").BigNumberProperty;
        is_tax_inclusive: import("@medusajs/framework/utils").BooleanProperty;
        shipping_option_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
        data: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
        original_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        original_subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        original_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        discount_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        discount_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
        cart: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, "Cart">, undefined>;
        tax_lines: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            code: import("@medusajs/framework/utils").TextProperty;
            rate: import("@medusajs/framework/utils").FloatProperty;
            provider_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            tax_rate_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
            shipping_method: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, {
                readonly name: "ShippingMethod";
                readonly tableName: "cart_shipping_method";
            }>, undefined>;
        }>, {
            readonly name: "ShippingMethodTaxLine";
            readonly tableName: "cart_shipping_method_tax_line";
        }>>;
        adjustments: import("@medusajs/framework/utils").HasMany<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder<{
            id: import("@medusajs/framework/utils").PrimaryKeyModifier<string, import("@medusajs/framework/utils").IdProperty>;
            description: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            code: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            amount: import("@medusajs/framework/utils").BigNumberProperty;
            provider_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            metadata: import("@medusajs/framework/utils").NullableModifier<Record<string, unknown>, import("@medusajs/framework/utils").JSONProperty>;
            promotion_id: import("@medusajs/framework/utils").NullableModifier<string, import("@medusajs/framework/utils").TextProperty>;
            shipping_method: import("@medusajs/framework/utils").BelongsTo<() => import("@medusajs/framework/utils").DmlEntity<import("@medusajs/framework/utils").DMLEntitySchemaBuilder</*elided*/ any>, {
                readonly name: "ShippingMethod";
                readonly tableName: "cart_shipping_method";
            }>, undefined>;
        }>, {
            readonly name: "ShippingMethodAdjustment";
            readonly tableName: "cart_shipping_method_adjustment";
        }>>;
    }>, {
        readonly name: "ShippingMethod";
        readonly tableName: "cart_shipping_method";
    }>>;
    /**
     * The original total amount of all items in the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_item_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The original subtotal amount of all items in the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_item_subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The original tax total amount of all items in the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_item_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The total amount of all items in the cart after discounts.
     *
     * @since 2.13.7
     */
    item_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The subtotal amount of all items in the cart after discounts.
     *
     * @since 2.13.7
     */
    item_subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The tax total amount of all items in the cart after discounts.
     *
     * @since 2.13.7
     */
    item_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The original total amount of the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The original subtotal amount of the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The original tax total amount of the cart before any discounts.
     *
     * @since 2.13.7
     */
    original_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The total amount of the cart after discounts.
     */
    total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The subtotal amount of the cart after discounts.
     */
    subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The tax total amount of the cart.
     */
    tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The total discount amount applied to the cart.
     */
    discount_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The total tax amount on discounts applied to the cart.
     */
    discount_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The total gift card amount applied to the cart.
     */
    gift_card_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The total tax amount on gift cards applied to the cart.
     */
    gift_card_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The total shipping amount for the cart.
     */
    shipping_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The shipping subtotal amount for the cart.
     */
    shipping_subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The total tax amount on shipping for the cart.
     */
    shipping_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The original total shipping amount for the cart before discounts.
     */
    original_shipping_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The original shipping subtotal amount for the cart before discounts.
     */
    original_shipping_subtotal: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
    /**
     * The original total tax amount on shipping for the cart before discounts.
     */
    original_shipping_tax_total: import("@medusajs/framework/utils").ComputedProperty<number | null, import("@medusajs/framework/utils").BigNumberProperty>;
}>, "Cart">;
export default Cart;
//# sourceMappingURL=cart.d.ts.map