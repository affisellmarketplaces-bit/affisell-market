import { t as DisclosureStore } from "../disclosure-store-BsaBaRKv.js";
import { a as PopoverStoreState, n as PopoverStoreFunctions, r as PopoverStoreOptions } from "../popover-store-Bc-l5VVO.js";
import { Store } from "@ariakit/react-store";
import * as Core from "@ariakit/components/composite/composite-overflow-store";

//#region src/composite/composite-overflow-store.d.ts
declare function useCompositeOverflowStoreProps<T extends Core.CompositeOverflowStore>(store: T, update: () => void, props: CompositeOverflowStoreProps): T & {
  disclosure: DisclosureStore | null | undefined;
};
/**
 * Creates a composite overflow store.
 * @see https://ariakit.com/components/composite
 * @example
 * ```jsx
 * const composite = useCompositeStore();
 * const overflow = useCompositeOverflowStore();
 * <Composite store={composite}>
 *   <CompositeItem>Item 1</CompositeItem>
 *   <CompositeItem>Item 2</CompositeItem>
 *   <CompositeOverflowDisclosure store={overflow}>
 *     +2 items
 *   </CompositeOverflowDisclosure>
 *   <CompositeOverflow store={overflow}>
 *     <CompositeItem>Item 3</CompositeItem>
 *     <CompositeItem>Item 4</CompositeItem>
 *   </CompositeOverflow>
 * </Composite>
 * ```
 */
declare function useCompositeOverflowStore(props?: CompositeOverflowStoreProps): CompositeOverflowStore;
interface CompositeOverflowStoreState extends Core.CompositeOverflowStoreState, PopoverStoreState {}
interface CompositeOverflowStoreFunctions extends Omit<Core.CompositeOverflowStoreFunctions, "disclosure">, PopoverStoreFunctions {}
interface CompositeOverflowStoreOptions extends Omit<Core.CompositeOverflowStoreOptions, "disclosure">, PopoverStoreOptions {}
type CompositeOverflowStoreProps = CompositeOverflowStoreOptions & Omit<Core.CompositeOverflowStoreProps, "disclosure">;
type CompositeOverflowStore = CompositeOverflowStoreFunctions & Omit<Store<Core.CompositeOverflowStore>, "disclosure">;
//#endregion
export { CompositeOverflowStore, CompositeOverflowStoreFunctions, CompositeOverflowStoreOptions, CompositeOverflowStoreProps, CompositeOverflowStoreState, useCompositeOverflowStore, useCompositeOverflowStoreProps };
//# sourceMappingURL=composite-overflow-store.d.ts.map