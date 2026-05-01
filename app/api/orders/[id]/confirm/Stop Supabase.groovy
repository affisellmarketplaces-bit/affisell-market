Stop Supabase. On utilise Prisma + Neon qui est déjà sync.

Crée le paiement HOLD à 3 partenaires :

- Modifie app/api/checkout/route.ts :
    * input: { productId, affiliateId }
    * charge product (basePrice, affiliateCommissionPercent, affisellFeePercent, supplierStripeId) et affiliateListing (addedMargin, affiliateStripeId) via Prisma
    * calcule en centimes :
    total = basePrice + addedMargin
    affisellFee = Math.round(total * affisellFeePercent / 100)
    affiliateAmount = Math.round(basePrice * affiliateCommissionPercent / 100) + addedMargin
    supplierAmount = total - affisellFee - affiliateAmount
    * crée stripe.checkout.sessions.create avec mode:'payment', sans transfer_data, et mets TOUT dans payment_intent_data.metadata
    * return { url }

- Crée app/api/webhook/route.ts :
    * écoute 'checkout.session.completed'
    * crée Order dans Prisma avec status='paid_held', deliveredAt=null, et tous les montants + IDs Stripe

- Crée app/api/orders/[id]/deliver/route.ts en POST qui met status='delivered' et deliveredAt=now()

Ne touche pas à Git. Code complet TypeScript.