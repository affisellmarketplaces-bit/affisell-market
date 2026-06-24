/**
 * @category Cart
 * @customNamespace Cart
 */
export declare const CartWorkflowEvents: {
    /**
     * Emitted when a cart is created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the cart
     * }
     * ```
     */
    readonly CREATED: "cart.created";
    /**
     * Emitted when a cart's details are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the cart
     * }
     * ```
     */
    readonly UPDATED: "cart.updated";
    /**
     * Emitted when the customer in the cart is updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the cart
     * }
     * ```
     */
    readonly CUSTOMER_UPDATED: "cart.customer_updated";
    /**
     * Emitted when the cart's region is updated. This
     * event is emitted alongside the `cart.updated` event.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the cart
     * }
     * ```
     */
    readonly REGION_UPDATED: "cart.region_updated";
    /**
     * Emitted when the customer in the cart is transferred.
     *
     * @since 2.8.0
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the cart
     *   customer_id, // The ID of the customer
     * }
     * ```
     */
    readonly CUSTOMER_TRANSFERRED: "cart.customer_transferred";
};
/**
 * @category Customer
 * @customNamespace Customer
 */
export declare const CustomerWorkflowEvents: {
    /**
     * Emitted when a customer is created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the customer
     * }
     * ```
     */
    readonly CREATED: "customer.created";
    /**
     * Emitted when a customer is updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the customer
     * }
     * ```
     */
    readonly UPDATED: "customer.updated";
    /**
     * Emitted when a customer is deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the customer
     * }
     * ```
     */
    readonly DELETED: "customer.deleted";
};
/**
 * @category Order
 * @customNamespace Order
 */
export declare const OrderWorkflowEvents: {
    /**
     * Emitted when the details of an order or draft order is updated. This
     * doesn't include updates made by an edit.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the order
     * }
     * ```
     */
    readonly UPDATED: "order.updated";
    /**
     * Emitted when an order is placed, or when a draft order is converted to an
     * order.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the order
     * }
     * ```
     */
    readonly PLACED: "order.placed";
    /**
     * Emitted when an order is canceld.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the order
     * }
     * ```
     */
    readonly CANCELED: "order.canceled";
    /**
     * Emitted when orders are completed.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the order
     * }
     * ```
     */
    readonly COMPLETED: "order.completed";
    /**
     * Emitted when an order is archived.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the order
     * }
     * ```
     */
    readonly ARCHIVED: "order.archived";
    /**
     * Emitted when a fulfillment is created for an order.
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   fulfillment_id, // The ID of the fulfillment
     *   no_notification, // (boolean) Whether to notify the customer
     * }
     * ```
     */
    readonly FULFILLMENT_CREATED: "order.fulfillment_created";
    /**
     * Emitted when an order's fulfillment is canceled.
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   fulfillment_id, // The ID of the fulfillment
     *   no_notification, // (boolean) Whether to notify the customer
     * }
     * ```
     */
    readonly FULFILLMENT_CANCELED: "order.fulfillment_canceled";
    /**
     * Emitted when a return request is confirmed.
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   return_id, // The ID of the return
     * }
     * ```
     */
    readonly RETURN_REQUESTED: "order.return_requested";
    /**
     * Emitted when a return is marked as received.
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   return_id, // The ID of the return
     * }
     * ```
     */
    readonly RETURN_RECEIVED: "order.return_received";
    /**
     * Emitted when a claim is created for an order.
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   claim_id, // The ID of the claim
     * }
     * ```
     */
    readonly CLAIM_CREATED: "order.claim_created";
    /**
     * Emitted when an exchange is created for an order.
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   exchange_id, // The ID of the exchange
     * }
     * ```
     */
    readonly EXCHANGE_CREATED: "order.exchange_created";
    /**
     * Emitted when an order is requested to be transferred to
     * another customer.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the order
     *   order_change_id, // The ID of the order change created for the transfer
     * }
     * ```
     */
    readonly TRANSFER_REQUESTED: "order.transfer_requested";
};
/**
 * @category Order Edit
 * @customNamespace Order
 */
export declare const OrderEditWorkflowEvents: {
    /**
     * Emitted when an order edit is requested.
     *
     * @since 2.8.0
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   actions, // (array) The [actions](https://docs.medusajs.com/resources/references/fulfillment/interfaces/fulfillment.OrderChangeActionDTO) to edit the order
     * }
     * ```
     */
    readonly REQUESTED: "order-edit.requested";
    /**
     * Emitted when an order edit request is confirmed.
     *
     * @since 2.8.0
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   actions, // (array) The [actions](https://docs.medusajs.com/resources/references/fulfillment/interfaces/fulfillment.OrderChangeActionDTO) to edit the order
     * }
     * ```
     */
    readonly CONFIRMED: "order-edit.confirmed";
    /**
     * Emitted when an order edit request is canceled.
     *
     * @since 2.8.0
     *
     * @eventPayload
     * ```ts
     * {
     *   order_id, // The ID of the order
     *   actions, // (array) The [actions](https://docs.medusajs.com/resources/references/fulfillment/interfaces/fulfillment.OrderChangeActionDTO) to edit the order
     * }
     * ```
     */
    readonly CANCELED: "order-edit.canceled";
};
/**
 * @category User
 * @customNamespace User
 */
export declare const UserWorkflowEvents: {
    /**
     * Emitted when users are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the user
     * }
     * ```
     */
    readonly CREATED: "user.created";
    /**
     * Emitted when users are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the user
     * }
     * ```
     */
    readonly UPDATED: "user.updated";
    /**
     * Emitted when users are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the user
     * }
     * ```
     */
    readonly DELETED: "user.deleted";
};
/**
 * @category Auth
 * @customNamespace Auth
 */
export declare const AuthWorkflowEvents: {
    /**
     * Emitted when a reset password token is generated. You can listen to this event
     * to send a reset password email to the user or customer, for example.
     *
     * @eventPayload
     * ```ts
     * {
     *   entity_id, // The identifier of the user or customer. For example, an email address.
     *   actor_type, // The type of actor. For example, "customer", "user", or custom.
     *   token, // The generated token.
     *   metadata, // Optional custom metadata passed from the request.
     * }
     * ```
     */
    readonly PASSWORD_RESET: "auth.password_reset";
    /**
     * Emitted when a verification code is generated. You can listen to
     * this event and decide how to deliver the code to the user or customer.
     *
     * @since 2.15.5
     *
     * @eventPayload
     * ```ts
     * {
     *   entity_id, // The identifier of the user or customer. For example, an email address.
     *   actor_type, // The type of actor. For example, "customer", "user", or custom.
     *   provider, // The auth provider that requested verification.
     *   auth_identity_id, // The ID of the auth identity being verified.
     *   provider_identity_id, // The ID of the provider identity being verified.
     *   code, // The generated verification code.
     *   expires_at, // The code expiry date.
     *   metadata, // Optional custom metadata passed from the request.
     * }
     * ```
     */
    readonly VERIFICATION_REQUESTED: "auth.verification_requested";
};
/**
 * @category Sales Channel
 * @customNamespace Sales Channel
 */
export declare const SalesChannelWorkflowEvents: {
    /**
     * Emitted when sales channels are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the sales channel
     * }
     * ```
     */
    readonly CREATED: "sales-channel.created";
    /**
     * Emitted when sales channels are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the sales channel
     * }
     * ```
     */
    readonly UPDATED: "sales-channel.updated";
    /**
     * Emitted when sales channels are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the sales channel
     * }
     * ```
     */
    readonly DELETED: "sales-channel.deleted";
};
/**
 * @category Product Category
 * @customNamespace Product
 */
export declare const ProductCategoryWorkflowEvents: {
    /**
     * Emitted when product categories are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product category
     * }
     * ```
     */
    readonly CREATED: "product-category.created";
    /**
     * Emitted when product categories are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product category
     * }
     * ```
     */
    readonly UPDATED: "product-category.updated";
    /**
     * Emitted when product categories are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product category
     * }
     * ```
     */
    readonly DELETED: "product-category.deleted";
};
/**
 * @category Product Collection
 * @customNamespace Product
 */
export declare const ProductCollectionWorkflowEvents: {
    /**
     * Emitted when product collections are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product collection
     * }
     * ```
     */
    readonly CREATED: "product-collection.created";
    /**
     * Emitted when product collections are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product collection
     * }
     * ```
     */
    readonly UPDATED: "product-collection.updated";
    /**
     * Emitted when product collections are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product collection
     * }
     * ```
     */
    readonly DELETED: "product-collection.deleted";
};
/**
 * @category Product Variant
 * @customNamespace Product
 */
export declare const ProductVariantWorkflowEvents: {
    /**
     * Emitted when product variants are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product variant
     * }
     * ```
     */
    readonly UPDATED: "product-variant.updated";
    /**
     * Emitted when product variants are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product variant
     * }
     * ```
     */
    readonly CREATED: "product-variant.created";
    /**
     * Emitted when product variants are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product variant
     * }
     * ```
     */
    readonly DELETED: "product-variant.deleted";
};
/**
 * @category Product
 * @customNamespace Product
 */
export declare const ProductWorkflowEvents: {
    /**
     * Emitted when products are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product
     * }
     * ```
     */
    readonly UPDATED: "product.updated";
    /**
     * Emitted when products are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product
     * }
     * ```
     */
    readonly CREATED: "product.created";
    /**
     * Emitted when products are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product
     * }
     * ```
     */
    readonly DELETED: "product.deleted";
};
/**
 * @category Product Type
 * @customNamespace Product
 */
export declare const ProductTypeWorkflowEvents: {
    /**
     * Emitted when product types are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product type
     * }
     * ```
     */
    readonly UPDATED: "product-type.updated";
    /**
     * Emitted when product types are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product type
     * }
     * ```
     */
    readonly CREATED: "product-type.created";
    /**
     * Emitted when product types are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product type
     * }
     * ```
     */
    readonly DELETED: "product-type.deleted";
};
/**
 * @category Product Tag
 * @customNamespace Product
 */
export declare const ProductTagWorkflowEvents: {
    /**
     * Emitted when product tags are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product tag
     * }
     * ```
     */
    readonly UPDATED: "product-tag.updated";
    /**
     * Emitted when product tags are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product tag
     * }
     * ```
     */
    readonly CREATED: "product-tag.created";
    /**
     * Emitted when product tags are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product tag
     * }
     * ```
     */
    readonly DELETED: "product-tag.deleted";
};
/**
 * @category Product Option
 * @customNamespace Product
 */
export declare const ProductOptionWorkflowEvents: {
    /**
     * Emitted when product options are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product option
     * }
     * ```
     */
    readonly UPDATED: "product-option.updated";
    /**
     * Emitted when product options are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product option
     * }
     * ```
     */
    readonly CREATED: "product-option.created";
    /**
     * Emitted when product options are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the product option
     * }
     * ```
     */
    readonly DELETED: "product-option.deleted";
};
/**
 * @category Invite
 * @customNamespace User
 */
export declare const InviteWorkflowEvents: {
    /**
     * Emitted when an invite is accepted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the invite
     * }
     * ```
     */
    readonly ACCEPTED: "invite.accepted";
    /**
     * Emitted when invites are created. You can listen to this event
     * to send an email to the invited users, for example.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the invite
     * }
     * ```
     */
    readonly CREATED: "invite.created";
    /**
     * Emitted when invites are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the invite
     * }
     * ```
     */
    readonly DELETED: "invite.deleted";
    /**
     * Emitted when invites should be resent because their token was
     * refreshed. You can listen to this event to send an email to the invited users,
     * for example.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the invite
     * }
     * ```
     */
    readonly RESENT: "invite.resent";
};
/**
 * @category Region
 * @customNamespace Region
 */
export declare const RegionWorkflowEvents: {
    /**
     * Emitted when regions are updated.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the region
     * }
     * ```
     */
    readonly UPDATED: "region.updated";
    /**
     * Emitted when regions are created.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the region
     * }
     * ```
     */
    readonly CREATED: "region.created";
    /**
     * Emitted when regions are deleted.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the region
     * }
     * ```
     */
    readonly DELETED: "region.deleted";
};
/**
 * @category Fulfillment
 * @customNamespace Fulfillment
 */
export declare const FulfillmentWorkflowEvents: {
    /**
     * Emitted when a shipment is created for an order.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // the ID of the fulfillment
     *   no_notification, // (boolean) whether to notify the customer
     * }
     * ```
     */
    readonly SHIPMENT_CREATED: "shipment.created";
    /**
     * Emitted when a fulfillment is marked as delivered.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // the ID of the fulfillment
     * }
     * ```
     */
    readonly DELIVERY_CREATED: "delivery.created";
};
/**
 * @category Shipping Option Type
 * @customNamespace Fulfillment
 */
export declare const ShippingOptionTypeWorkflowEvents: {
    /**
     * Emitted when shipping option types are updated.
     *
     * @since 2.10.0
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the shipping option type
     * }
     * ```
     */
    readonly UPDATED: "shipping-option-type.updated";
    /**
     * Emitted when shipping option types are created.
     *
     * @since 2.10.0
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the shipping option type
     * }
     * ```
     */
    readonly CREATED: "shipping-option-type.created";
    /**
     * Emitted when shipping option types are deleted.
     *
     * @since 2.10.0
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the shipping option type
     * }
     * ```
     */
    readonly DELETED: "shipping-option-type.deleted";
};
/**
 * @category Shipping Option
 * @customNamespace Fulfillment
 */
export declare const ShippingOptionWorkflowEvents: {
    /**
     * Emitted when shipping options are created.
     *
     * @since 2.12.4
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the shipping option
     * }
     * ```
     */
    readonly CREATED: "shipping-option.created";
    /**
     * Emitted when shipping options are updated.
     *
     * @since 2.12.4
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the shipping option
     * }
     * ```
     */
    readonly UPDATED: "shipping-option.updated";
    /**
     * Emitted when shipping options are deleted.
     *
     * @since 2.12.4
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the shipping option
     * }
     * ```
     */
    readonly DELETED: "shipping-option.deleted";
};
/**
 * @category Payment
 * @customNamespace Payment
 */
export declare const PaymentEvents: {
    /**
     * Emitted when a payment is captured.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // the ID of the payment
     * }
     * ```
     */
    readonly CAPTURED: "payment.captured";
    /**
     * Emitted when a payment is refunded.
     *
     * @eventPayload
     * ```ts
     * {
     *   id, // the ID of the payment
     * }
     * ```
     */
    readonly REFUNDED: "payment.refunded";
};
/**
 * @category Translation
 * @customNamespace Translation
 */
export declare const TranslationWorkflowEvents: {
    /**
     * Emitted when translations are created.
     *
     * @since 2.12.3
     * @featureFlag translation
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the translation
     * }
     * ```
     */
    readonly CREATED: "translation.created";
    /**
     * Emitted when translations are updated.
     *
     * @since 2.12.3
     * @featureFlag translation
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the translation
     * }
     * ```
     */
    readonly UPDATED: "translation.updated";
    /**
     * Emitted when translations are deleted.
     *
     * @since 2.12.3
     * @featureFlag translation
     * @eventPayload
     * ```ts
     * {
     *   id, // The ID of the translation
     * }
     * ```
     */
    readonly DELETED: "translation.deleted";
};
//# sourceMappingURL=events.d.ts.map