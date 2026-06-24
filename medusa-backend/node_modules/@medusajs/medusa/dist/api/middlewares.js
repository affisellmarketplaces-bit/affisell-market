"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const define_middlewares_1 = require("../utils/define-middlewares");
const middlewares_1 = require("./admin/api-keys/middlewares");
const middlewares_2 = require("./admin/campaigns/middlewares");
const middlewares_3 = require("./admin/claims/middlewares");
const middlewares_4 = require("./admin/collections/middlewares");
const middlewares_5 = require("./admin/currencies/middlewares");
const middlewares_6 = require("./admin/customer-groups/middlewares");
const middlewares_7 = require("./admin/customers/middlewares");
const middlewares_8 = require("./admin/draft-orders/middlewares");
const middlewares_9 = require("./admin/exchanges/middlewares");
const middlewares_10 = require("./admin/fulfillment-providers/middlewares");
const middlewares_11 = require("./admin/fulfillment-sets/middlewares");
const middlewares_12 = require("./admin/fulfillments/middlewares");
const middlewares_13 = require("./admin/inventory-items/middlewares");
const middlewares_14 = require("./admin/invites/middlewares");
const middlewares_15 = require("./admin/notifications/middlewares");
const middlewares_16 = require("./admin/order-changes/middlewares");
const middlewares_17 = require("./admin/order-edits/middlewares");
const middlewares_18 = require("./admin/orders/middlewares");
const middlewares_19 = require("./admin/payment-collections/middlewares");
const middlewares_20 = require("./admin/payments/middlewares");
const middlewares_21 = require("./admin/price-lists/middlewares");
const middlewares_22 = require("./admin/price-preferences/middlewares");
const middlewares_23 = require("./admin/product-categories/middlewares");
const middlewares_24 = require("./admin/product-tags/middlewares");
const middlewares_25 = require("./admin/product-types/middlewares");
const middlewares_26 = require("./admin/product-variants/middlewares");
const middlewares_27 = require("./admin/products/middlewares");
const middlewares_28 = require("./admin/promotions/middlewares");
const middlewares_29 = require("./admin/property-labels/middlewares");
const middlewares_30 = require("./admin/rbac/middlewares");
const middlewares_31 = require("./admin/refund-reasons/middlewares");
const middlewares_32 = require("./admin/regions/middlewares");
const middlewares_33 = require("./admin/reservations/middlewares");
const middlewares_34 = require("./admin/return-reasons/middlewares");
const middlewares_35 = require("./admin/returns/middlewares");
const middlewares_36 = require("./admin/sales-channels/middlewares");
const middlewares_37 = require("./admin/shipping-options/middlewares");
const middlewares_38 = require("./admin/shipping-profiles/middlewares");
const middlewares_39 = require("./admin/stock-locations/middlewares");
const middlewares_40 = require("./admin/stores/middlewares");
const middlewares_41 = require("./admin/tax-providers/middlewares");
const middlewares_42 = require("./admin/tax-rates/middlewares");
const middlewares_43 = require("./admin/tax-regions/middlewares");
const middlewares_44 = require("./admin/uploads/middlewares");
const middlewares_45 = require("./admin/users/middlewares");
const middlewares_46 = require("./admin/views/[entity]/columns/middlewares");
const middlewares_47 = require("./admin/views/[entity]/configurations/middlewares");
const middlewares_48 = require("./admin/views/entities/middlewares");
const middlewares_49 = require("./admin/workflows-executions/middlewares");
const middlewares_50 = require("./auth/middlewares");
const middlewares_51 = require("./cloud/middlewares");
const middlewares_52 = require("./hooks/middlewares");
const middlewares_53 = require("./store/carts/middlewares");
const middlewares_54 = require("./store/collections/middlewares");
const middlewares_55 = require("./store/currencies/middlewares");
const middlewares_56 = require("./store/customers/middlewares");
const middlewares_57 = require("./store/middlewares");
const middlewares_58 = require("./store/orders/middlewares");
const middlewares_59 = require("./store/payment-collections/middlewares");
const middlewares_60 = require("./store/payment-providers/middlewares");
const middlewares_61 = require("./store/product-categories/middlewares");
const middlewares_62 = require("./store/product-tags/middlewares");
const middlewares_63 = require("./store/product-types/middlewares");
const middlewares_64 = require("./store/product-variants/middlewares");
const middlewares_65 = require("./store/products/middlewares");
const middlewares_66 = require("./store/regions/middlewares");
const middlewares_67 = require("./store/return-reasons/middlewares");
const middlewares_68 = require("./store/shipping-options/middlewares");
const middlewares_69 = require("./admin/shipping-option-types/middlewares");
const middlewares_70 = require("./admin/index/middlewares");
const framework_1 = require("@medusajs/framework");
const middlewares_71 = require("./admin/locales/middlewares");
const middlewares_72 = require("./admin/translations/middlewares");
exports.default = (0, define_middlewares_1.defineMiddlewares)([
    ...middlewares_57.storeRoutesMiddlewares,
    {
        matcher: "/admin*",
        middlewares: [framework_1.setSecretApiKeyContext],
    },
    ...middlewares_6.adminCustomerGroupRoutesMiddlewares,
    ...middlewares_7.adminCustomerRoutesMiddlewares,
    ...middlewares_29.adminPropertyLabelsMiddlewares,
    ...middlewares_28.adminPromotionRoutesMiddlewares,
    ...middlewares_2.adminCampaignRoutesMiddlewares,
    ...middlewares_53.storeCartRoutesMiddlewares,
    ...middlewares_56.storeCustomerRoutesMiddlewares,
    ...middlewares_53.storeCartRoutesMiddlewares,
    ...middlewares_54.storeCollectionRoutesMiddlewares,
    ...middlewares_61.storeProductCategoryRoutesMiddlewares,
    ...middlewares_62.storeProductTagRoutesMiddlewares,
    ...middlewares_63.storeProductTypeRoutesMiddlewares,
    ...middlewares_60.storePaymentProvidersMiddlewares,
    ...middlewares_68.storeShippingOptionRoutesMiddlewares,
    ...middlewares_59.storePaymentCollectionsMiddlewares,
    ...middlewares_58.storeOrderRoutesMiddlewares,
    ...middlewares_50.authRoutesMiddlewares,
    ...middlewares_49.adminWorkflowsExecutionsMiddlewares,
    ...middlewares_35.adminReturnRoutesMiddlewares,
    ...middlewares_66.storeRegionRoutesMiddlewares,
    ...middlewares_32.adminRegionRoutesMiddlewares,
    ...middlewares_30.adminRbacRoutesMiddlewares,
    ...middlewares_35.adminReturnRoutesMiddlewares,
    ...middlewares_45.adminUserRoutesMiddlewares,
    ...middlewares_14.adminInviteRoutesMiddlewares,
    ...middlewares_42.adminTaxRateRoutesMiddlewares,
    ...middlewares_43.adminTaxRegionRoutesMiddlewares,
    ...middlewares_72.adminTranslationsRoutesMiddlewares,
    ...middlewares_1.adminApiKeyRoutesMiddlewares,
    ...middlewares_52.hooksRoutesMiddlewares,
    ...middlewares_40.adminStoreRoutesMiddlewares,
    ...middlewares_5.adminCurrencyRoutesMiddlewares,
    ...middlewares_71.adminLocalesRoutesMiddlewares,
    ...middlewares_55.storeCurrencyRoutesMiddlewares,
    ...middlewares_27.adminProductRoutesMiddlewares,
    ...middlewares_20.adminPaymentRoutesMiddlewares,
    ...middlewares_21.adminPriceListsRoutesMiddlewares,
    ...middlewares_22.adminPricePreferencesRoutesMiddlewares,
    ...middlewares_13.adminInventoryRoutesMiddlewares,
    ...middlewares_4.adminCollectionRoutesMiddlewares,
    ...middlewares_37.adminShippingOptionRoutesMiddlewares,
    ...middlewares_8.adminDraftOrderRoutesMiddlewares,
    ...middlewares_36.adminSalesChannelRoutesMiddlewares,
    ...middlewares_39.adminStockLocationRoutesMiddlewares,
    ...middlewares_69.adminShippingOptionTypeRoutesMiddlewares,
    ...middlewares_25.adminProductTypeRoutesMiddlewares,
    ...middlewares_24.adminProductTagRoutesMiddlewares,
    ...middlewares_44.adminUploadRoutesMiddlewares,
    ...middlewares_11.adminFulfillmentSetsRoutesMiddlewares,
    ...middlewares_15.adminNotificationRoutesMiddlewares,
    ...middlewares_18.adminOrderRoutesMiddlewares,
    ...middlewares_33.adminReservationRoutesMiddlewares,
    ...middlewares_23.adminProductCategoryRoutesMiddlewares,
    ...middlewares_38.adminShippingProfilesMiddlewares,
    ...middlewares_12.adminFulfillmentsRoutesMiddlewares,
    ...middlewares_10.adminFulfillmentProvidersRoutesMiddlewares,
    ...middlewares_65.storeProductRoutesMiddlewares,
    ...middlewares_64.storeProductVariantRoutesMiddlewares,
    ...middlewares_67.storeReturnReasonRoutesMiddlewares,
    ...middlewares_34.adminReturnReasonRoutesMiddlewares,
    ...middlewares_3.adminClaimRoutesMiddlewares,
    ...middlewares_31.adminRefundReasonsRoutesMiddlewares,
    ...middlewares_9.adminExchangeRoutesMiddlewares,
    ...middlewares_26.adminProductVariantRoutesMiddlewares,
    ...middlewares_41.adminTaxProviderRoutesMiddlewares,
    ...middlewares_16.adminOrderChangesRoutesMiddlewares,
    ...middlewares_17.adminOrderEditRoutesMiddlewares,
    ...middlewares_19.adminPaymentCollectionsMiddlewares,
    ...middlewares_47.viewConfigurationRoutesMiddlewares,
    ...middlewares_48.entitiesRoutesMiddlewares,
    ...middlewares_46.columnRoutesMiddlewares,
    ...middlewares_70.adminIndexRoutesMiddlewares,
    ...middlewares_51.cloudRoutesMiddlewares,
]);
//# sourceMappingURL=middlewares.js.map