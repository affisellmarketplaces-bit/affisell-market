import { t as DisclosureStore } from "../disclosure-store-BsaBaRKv.js";
import { a as HovercardStoreState, n as HovercardStoreFunctions, r as HovercardStoreOptions } from "../hovercard-store-gIeoQEn_.js";
import { Store } from "@ariakit/react-store";
import * as Core from "@ariakit/components/tooltip/tooltip-store";

//#region src/tooltip/tooltip-store.d.ts
declare function useTooltipStoreProps<T extends Core.TooltipStore>(store: T, update: () => void, props: TooltipStoreProps): T & {
  disclosure: DisclosureStore | null | undefined;
};
/**
 * Creates a tooltip store to control the state of
 * [Tooltip](https://ariakit.com/components/tooltip) components.
 * @see https://ariakit.com/components/tooltip
 * @example
 * ```jsx
 * const tooltip = useTooltipStore();
 *
 * <TooltipAnchor store={tooltip}>Anchor</TooltipAnchor>
 * <Tooltip store={tooltip}>Tooltip</Tooltip>
 * ```
 */
declare function useTooltipStore(props?: TooltipStoreProps): TooltipStore;
interface TooltipStoreState extends Core.TooltipStoreState, HovercardStoreState {}
interface TooltipStoreFunctions extends Omit<Core.TooltipStoreFunctions, "disclosure">, HovercardStoreFunctions {}
interface TooltipStoreOptions extends Omit<Core.TooltipStoreOptions, "disclosure">, HovercardStoreOptions {}
interface TooltipStoreProps extends TooltipStoreOptions, Omit<Core.TooltipStoreProps, "disclosure"> {}
interface TooltipStore extends TooltipStoreFunctions, Omit<Store<Core.TooltipStore>, "disclosure"> {}
//#endregion
export { TooltipStore, TooltipStoreFunctions, TooltipStoreOptions, TooltipStoreProps, TooltipStoreState, useTooltipStore, useTooltipStoreProps };
//# sourceMappingURL=tooltip-store.d.ts.map