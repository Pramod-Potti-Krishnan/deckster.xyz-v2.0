// Canvas v2 P4 — the ONE action model behind both slide-thumbnail menus
// (right-click ContextMenu and the ⋯ DropdownMenu). Pure and vm-tested
// (scripts/test-slide-thumbnail-menu.mjs) so the two renderers cannot drift.

export interface SlideThumbnailMenuModel {
  duplicate: { disabled: boolean } | null
  changeLayout: { disabled: boolean } | null
  moveUp: { disabled: boolean } | null
  moveDown: { disabled: boolean } | null
  delete: { label: string; multi: boolean; disabled: boolean } | null
}

export function getSlideMenuActions(args: {
  realSlideNumber: number
  slidesTotal: number
  isItemProcessing: boolean
  selectedCount: number
  can: {
    duplicate: boolean
    changeLayout: boolean
    reorder: boolean
    deleteOne: boolean
    deleteMulti: boolean
  }
}): SlideThumbnailMenuModel {
  const { realSlideNumber, slidesTotal, isItemProcessing, selectedCount, can } = args
  const multi = selectedCount > 1 && can.deleteMulti
  return {
    duplicate: can.duplicate ? { disabled: isItemProcessing } : null,
    changeLayout: can.changeLayout ? { disabled: isItemProcessing } : null,
    moveUp: can.reorder
      ? { disabled: isItemProcessing || realSlideNumber <= 1 }
      : null,
    moveDown: can.reorder
      ? { disabled: isItemProcessing || realSlideNumber >= slidesTotal }
      : null,
    delete: multi
      ? {
          label: `Delete ${selectedCount} Slides`,
          multi: true,
          disabled: isItemProcessing || selectedCount >= slidesTotal,
        }
      : can.deleteOne
        ? {
            label: 'Delete Slide',
            multi: false,
            disabled: isItemProcessing || slidesTotal <= 1,
          }
        : null,
  }
}

export function slideMenuHasAnyAction(model: SlideThumbnailMenuModel): boolean {
  return Boolean(
    model.duplicate || model.changeLayout || model.moveUp || model.moveDown || model.delete,
  )
}
