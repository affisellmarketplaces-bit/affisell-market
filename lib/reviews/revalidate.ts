import { revalidateTag } from "next/cache"

/** Next.js 16 requires a cache life profile as the second argument. */
export function revalidateProductReviews(productId: string) {
  revalidateTag(`reviews-${productId}`, "max")
  revalidateTag(`product-${productId}`, "max")
}
