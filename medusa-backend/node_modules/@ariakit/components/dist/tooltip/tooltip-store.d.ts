import { HovercardStoreFunctions, HovercardStoreOptions, HovercardStoreState } from "../hovercard/hovercard-store.js";
import { Store, StoreOptions, StoreProps } from "@ariakit/store";

//#region src/tooltip/tooltip-store.d.ts
/**
 * Creates a tooltip store.
 */
declare function createTooltipStore(props?: TooltipStoreProps): TooltipStore;
interface TooltipStoreState extends HovercardStoreState {
  /** @default "top" */
  placement: HovercardStoreState["placement"];
  /** @default 0 */
  hideTimeout?: HovercardStoreState["hideTimeout"];
  /**
   * Determines whether the tooltip is being used as a label or a description
   * for the anchor element.
   * @deprecated Render a visually hidden label or use the `aria-label` or
   * `aria-labelledby` attributes on the anchor element instead.
   * @default "description"
   */
  type: "label" | "description";
  /**
   * The amount of time after a tooltip is hidden while all tooltips on the
   * page can be shown immediately, without waiting for the show timeout.
   * @default 300
   */
  skipTimeout: number;
}
type TooltipStoreFunctions = HovercardStoreFunctions;
interface TooltipStoreOptions extends StoreOptions<TooltipStoreState, "type" | "placement" | "timeout" | "showTimeout" | "hideTimeout" | "skipTimeout">, HovercardStoreOptions {}
interface TooltipStoreProps extends TooltipStoreOptions, StoreProps<TooltipStoreState> {}
interface TooltipStore extends TooltipStoreFunctions, Store<TooltipStoreState> {}
//#endregion
export { TooltipStore, TooltipStoreFunctions, TooltipStoreOptions, TooltipStoreProps, TooltipStoreState, createTooltipStore };
//# sourceMappingURL=tooltip-store.d.ts.map