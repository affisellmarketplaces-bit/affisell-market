//#region src/dialog/utils/use-root-dialog.d.ts
interface Props {
  attribute: string;
  contentId?: string;
  contentElement?: HTMLElement | null;
  enabled?: boolean;
}
declare function useRootDialog({
  attribute,
  contentId,
  contentElement,
  enabled
}: Props): () => boolean;
//#endregion
export { useRootDialog };
//# sourceMappingURL=use-root-dialog.d.ts.map