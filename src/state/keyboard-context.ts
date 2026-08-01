import type { AppState } from "./app-state"

type RouteBindingState = Pick<AppState,
  | "authOnboarding"
  | "commandPaletteOpen"
  | "commentEditing"
  | "configEditing"
  | "detailBodyEditing"
  | "helpOpen"
  | "inspectorEditingFieldId"
  | "pendingDeleteIssueKey"
  | "projectPicker"
  | "remoteApplyOpen"
  | "searchOpen"
  | "stagedDiscardOpen"
>

export function routeBindingsBlocked(state: RouteBindingState) {
  return state.authOnboarding.open
    || state.commandPaletteOpen
    || state.commentEditing
    || !!state.configEditing
    || state.detailBodyEditing
    || state.helpOpen
    || !!state.inspectorEditingFieldId
    || !!state.pendingDeleteIssueKey
    || state.projectPicker.open
    || state.remoteApplyOpen
    || state.searchOpen
    || state.stagedDiscardOpen
}

export function halfViewportRows(visibleRows: number) {
  return Math.max(1, Math.floor(Math.max(1, visibleRows) / 2))
}
