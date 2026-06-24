import { a as CompositeStoreProps, r as CompositeStoreItem } from "../composite-store-DyJc-XRA.js";
import { ReactElement, ReactNode } from "react";
import { PickRequired } from "@ariakit/utils";

//#region src/composite/composite-provider.d.ts
/**
 * Provides a composite store to
 * [`CompositeItem`](https://ariakit.com/reference/composite-item) components.
 * @see https://ariakit.com/components/composite
 * @example
 * ```jsx
 * <CompositeProvider>
 *   <Composite>
 *     <CompositeItem />
 *     <CompositeItem />
 *     <CompositeItem />
 *   </Composite>
 * </CompositeProvider>
 * ```
 */
declare function CompositeProvider<T extends CompositeStoreItem = CompositeStoreItem>(props: PickRequired<CompositeProviderProps<T>, "items" | "defaultItems">): ReactElement;
declare function CompositeProvider(props?: CompositeProviderProps): ReactElement;
interface CompositeProviderProps<T extends CompositeStoreItem = CompositeStoreItem> extends CompositeStoreProps<T> {
  children?: ReactNode;
}
//#endregion
export { CompositeProvider, CompositeProviderProps };
//# sourceMappingURL=composite-provider.d.ts.map