import { createStore } from "solid-js/store"
import { createRequiredContext, type ProviderProps } from "./helper"
import type { AppState, BacklogGroupBy, BoardGroupBy, FocusPane, IssueSummary, QuickFilterId } from "../state/app-state"
import { sidebarRoutes, type AppRoute } from "../state/routes"
import { applyIssueDraft, isEditableField, issueFieldDisplayValue, issueFields, selectedIssueField } from "../state/issue-fields"
import { stagedChanges } from "../state/staged-changes"
import { useToast } from "./toast"

export type AppStateContext = {
  state: AppState
  setRoute: (route: AppRoute) => void
  setFocusedPane: (pane: FocusPane) => void
  focusNextPane: (delta: 1 | -1) => void
  moveSidebarSelection: (delta: number) => void
  openSidebarSelection: () => void
  toggleSidebarFilterSelection: () => void
  toggleQuickFilter: (filterId: QuickFilterId) => void
  selectIssue: (issueKey: string) => void
  openIssueDetail: (issueKey?: string) => void
  closeIssueDetail: () => void
  moveInspectorSelection: (delta: number) => void
  moveInspectorChoice: (delta: number) => void
  startInspectorEdit: () => void
  updateInspectorEditValue: (value: string) => void
  commitInspectorEdit: () => void
  cancelInspectorEdit: () => void
  discardInspectorFieldChange: () => void
  requestIssueDelete: () => void
  confirmIssueDelete: () => void
  cancelIssueDelete: () => void
  openRemoteIssueApply: () => void
  closeRemoteIssueApply: () => void
  confirmRemoteIssueApply: () => void
  startDetailBodyEdit: () => void
  updateDetailBodyEditValue: (value: string) => void
  commitDetailBodyEdit: () => void
  cancelDetailBodyEdit: () => void
  openStagedDiscard: () => void
  closeStagedDiscard: () => void
  moveStagedDiscardSelection: (delta: number) => void
  toggleStagedDiscardSelection: () => void
  confirmStagedDiscard: () => void
  applyIssueChanges: () => void
  createDraftIssue: (issue: IssueSummary) => void
  setActiveSprintGroupBy: (groupBy: BoardGroupBy) => void
  setKanbanGroupBy: (groupBy: BoardGroupBy) => void
  setBacklogGroupBy: (groupBy: BacklogGroupBy) => void
  setActiveSprintStatusOffset: (offset: number) => void
  setKanbanStatusOffset: (offset: number) => void
}

const [AppStateContextProvider, useAppState] = createRequiredContext<AppStateContext>("AppState")

export { useAppState }

export function AppStateProvider(props: ProviderProps<{ initialState: AppState }>) {
  const [state, setState] = createStore<AppState>(props.initialState)
  const toast = useToast()

  const context: AppStateContext = {
    state,
    setRoute(route) {
      setState("route", route)
      const index = sidebarRoutes.findIndex((candidate) => candidate.id === route)
      if (index !== -1) setState("sidebarSelectedIndex", index)
      if (route === "issue-detail") setState("focusedPane", "main")
      if (route !== "issue-detail") setState("previousRoute", undefined)
    },
    setFocusedPane(pane) {
      setState("focusedPane", pane)
    },
    focusNextPane(delta) {
      const panes: FocusPane[] = ["sidebar", "main", "inspector"]
      const currentIndex = Math.max(0, panes.indexOf(state.focusedPane))
      setState("focusedPane", panes[(currentIndex + delta + panes.length) % panes.length]!)
    },
    moveSidebarSelection(delta) {
      const entryCount = sidebarRoutes.length + state.quickFilters.length
      const nextIndex = (state.sidebarSelectedIndex + delta + entryCount) % entryCount
      setState("sidebarSelectedIndex", nextIndex)
    },
    openSidebarSelection() {
      if (state.sidebarSelectedIndex < sidebarRoutes.length) {
        setState("route", sidebarRoutes[state.sidebarSelectedIndex]?.id ?? "active-sprint")
        return
      }
      context.toggleSidebarFilterSelection()
    },
    toggleSidebarFilterSelection() {
      const filter = state.quickFilters[state.sidebarSelectedIndex - sidebarRoutes.length]
      if (filter) context.toggleQuickFilter(filter.id)
    },
    toggleQuickFilter(filterId) {
      setState("activeQuickFilters", (filters) =>
        filters.includes(filterId) ? filters.filter((candidate) => candidate !== filterId) : [...filters, filterId],
      )
    },
    selectIssue(issueKey) {
      setState("selectedIssueKey", issueKey)
    },
    openIssueDetail(issueKey) {
      if (issueKey) setState("selectedIssueKey", issueKey)
      if (state.route !== "issue-detail") setState("previousRoute", state.route)
      setState("route", "issue-detail")
      setState("focusedPane", "main")
    },
    closeIssueDetail() {
      if (state.route !== "issue-detail") return
      setState("route", state.previousRoute ?? "active-sprint")
      setState("previousRoute", undefined)
      setState("focusedPane", "main")
    },
    moveInspectorSelection(delta) {
      const nextIndex = (state.inspectorSelectedFieldIndex + delta + issueFields.length) % issueFields.length
      setState("inspectorSelectedFieldIndex", nextIndex)
    },
    moveInspectorChoice(delta) {
      const fieldId = state.inspectorEditingFieldId
      if (fieldId !== "statusId" && fieldId !== "type") return
      const choices = fieldId === "statusId" ? state.statuses.map((status) => status.id) : state.issueTypes.map((type) => type.id)
      if (!choices.length) return
      const currentIndex = Math.max(0, choices.findIndex((choice) => choice === state.inspectorEditValue))
      setState("inspectorEditValue", choices[(currentIndex + delta + choices.length) % choices.length]!)
    },
    startInspectorEdit() {
      const issue = state.issues[state.selectedIssueKey]
      const field = selectedIssueField(state)
      if (!issue || !field || !field.editable || !isEditableField(field.id)) return
      setState("inspectorEditingFieldId", field.id)
      setState("inspectorEditValue", field.id === "statusId" ? issue.statusId : field.id === "type" ? issue.type : issueFieldDisplayValue(state, issue, field))
    },
    updateInspectorEditValue(value) {
      setState("inspectorEditValue", value)
    },
    commitInspectorEdit() {
      const issueKey = state.selectedIssueKey
      const fieldId = state.inspectorEditingFieldId
      if (!fieldId) return
      setState("issueDrafts", { ...state.issueDrafts, [issueKey]: { ...(state.issueDrafts[issueKey] ?? {}), [fieldId]: state.inspectorEditValue } })
      setState("inspectorEditingFieldId", undefined)
      setState("inspectorEditValue", "")
    },
    cancelInspectorEdit() {
      setState("inspectorEditingFieldId", undefined)
      setState("inspectorEditValue", "")
    },
    discardInspectorFieldChange() {
      const issueKey = state.selectedIssueKey
      const field = selectedIssueField(state)
      if (!field || !isEditableField(field.id)) return
      const draft = { ...(state.issueDrafts[issueKey] ?? {}) }
      delete draft[field.id]
      setState("issueDrafts", { ...state.issueDrafts, [issueKey]: draft })
      if (state.inspectorEditingFieldId === field.id) context.cancelInspectorEdit()
    },
    requestIssueDelete() {
      if (state.inspectorEditingFieldId || state.detailBodyEditing) return
      if (!state.issues[state.selectedIssueKey]) return
      setState("pendingDeleteIssueKey", state.selectedIssueKey)
    },
    confirmIssueDelete() {
      const issueKey = state.pendingDeleteIssueKey
      if (!issueKey) return
      setState("issueDeletes", (issueDeletes) => (issueDeletes.includes(issueKey) ? issueDeletes : [...issueDeletes, issueKey]))
      setState("pendingDeleteIssueKey", undefined)
      const drafts = { ...state.issueDrafts }
      delete drafts[issueKey]
      setState("issueDrafts", drafts)
    },
    cancelIssueDelete() {
      setState("pendingDeleteIssueKey", undefined)
    },
    openRemoteIssueApply() {
      setState("remoteApplyOpen", true)
      setState("stagedDiscardOpen", false)
      setState("stagedDiscardSelectedIndex", 0)
      setState("stagedDiscardSelections", [])
    },
    closeRemoteIssueApply() {
      setState("remoteApplyOpen", false)
    },
    confirmRemoteIssueApply() {
      const changeCount = stagedChanges(state).length
      setState("remoteApplyOpen", false)
      toast.show(changeCount ? "Jira write path is not wired yet; staged changes kept" : "No staged changes to write")
    },
    startDetailBodyEdit() {
      const issue = state.issues[state.selectedIssueKey]
      if (!issue || state.route !== "issue-detail") return
      setState("detailBodyEditValue", detailBodyInitialValue(state, issue))
      setState("detailBodyEditing", true)
      setState("focusedPane", "main")
    },
    updateDetailBodyEditValue(value) {
      setState("detailBodyEditValue", value)
    },
    commitDetailBodyEdit() {
      if (!state.detailBodyEditing) return
      const issueKey = state.selectedIssueKey
      setState("issueDrafts", { ...state.issueDrafts, [issueKey]: { ...(state.issueDrafts[issueKey] ?? {}), description: state.detailBodyEditValue } })
      setState("detailBodyEditing", false)
      setState("detailBodyEditValue", "")
    },
    cancelDetailBodyEdit() {
      setState("detailBodyEditing", false)
      setState("detailBodyEditValue", "")
    },
    openStagedDiscard() {
      setState("stagedDiscardOpen", true)
      setState("remoteApplyOpen", false)
      setState("stagedDiscardSelectedIndex", 0)
      setState("stagedDiscardSelections", [])
    },
    closeStagedDiscard() {
      setState("stagedDiscardOpen", false)
      setState("stagedDiscardSelectedIndex", 0)
      setState("stagedDiscardSelections", [])
    },
    moveStagedDiscardSelection(delta) {
      const changes = stagedChanges(state)
      if (!changes.length) return
      setState("stagedDiscardSelectedIndex", (state.stagedDiscardSelectedIndex + delta + changes.length) % changes.length)
    },
    toggleStagedDiscardSelection() {
      const change = stagedChanges(state)[state.stagedDiscardSelectedIndex]
      if (!change) return
      setState("stagedDiscardSelections", (selections) =>
        selections.includes(change.id) ? selections.filter((id) => id !== change.id) : [...selections, change.id],
      )
    },
    confirmStagedDiscard() {
      const changes = stagedChanges(state)
      const fallback = changes[state.stagedDiscardSelectedIndex]?.id
      const selectedIds = state.stagedDiscardSelections.length ? new Set(state.stagedDiscardSelections) : new Set(fallback ? [fallback] : [])
      if (!selectedIds.size) return
      const issueDrafts = { ...state.issueDrafts }
      let issueDeletes = [...state.issueDeletes]
      for (const change of changes) {
        if (!selectedIds.has(change.id)) continue
        if (change.kind === "delete") {
          issueDeletes = issueDeletes.filter((issueKey) => issueKey !== change.issueKey)
          continue
        }
        const draft = { ...(issueDrafts[change.issueKey] ?? {}) }
        delete draft[change.fieldId]
        if (Object.keys(draft).length) issueDrafts[change.issueKey] = draft
        else delete issueDrafts[change.issueKey]
      }
      setState("issueDrafts", issueDrafts)
      setState("issueDeletes", issueDeletes)
      context.closeStagedDiscard()
    },
    applyIssueChanges() {
      const changeCount = stagedChanges(state).length
      if (!changeCount) {
        toast.show("No staged changes to apply locally")
        return
      }
      const drafts = { ...state.issueDrafts }
      const deletedIssueKeys = new Set(state.issueDeletes)
      for (const [issueKey, draft] of Object.entries(drafts)) {
        if (deletedIssueKeys.has(issueKey)) continue
        const issue = state.issues[issueKey]
        if (!issue || !Object.keys(draft).length) continue
        setState("issues", issueKey, applyIssueDraft(issue, draft, state))
      }
      if (deletedIssueKeys.size) {
        const issues = Object.fromEntries(Object.entries(state.issues).filter(([issueKey]) => !deletedIssueKeys.has(issueKey)))
        setState("issues", issues)
        if (deletedIssueKeys.has(state.selectedIssueKey)) {
          const nextIssueKey = Object.keys(issues)[0]
          if (nextIssueKey) setState("selectedIssueKey", nextIssueKey)
          if (state.route === "issue-detail") context.closeIssueDetail()
        }
      }
      setState("issueDrafts", {})
      setState("issueDeletes", [])
      setState("pendingDeleteIssueKey", undefined)
      setState("remoteApplyOpen", false)
      setState("stagedDiscardOpen", false)
      setState("stagedDiscardSelectedIndex", 0)
      setState("stagedDiscardSelections", [])
      setState("inspectorEditingFieldId", undefined)
      setState("inspectorEditValue", "")
      setState("detailBodyEditing", false)
      setState("detailBodyEditValue", "")
      toast.show(`Applied ${changeCount} staged change${changeCount === 1 ? "" : "s"} locally`)
    },
    createDraftIssue(issue) {
      setState("issues", issue.key, issue)
      setState("selectedIssueKey", issue.key)
      setState("focusedPane", "inspector")
      setState("draftIssueCounter", state.draftIssueCounter + 1)
      setState("inspectorSelectedFieldIndex", issueFields.findIndex((field) => field.id === "title"))
      setState("inspectorEditingFieldId", "title")
      setState("inspectorEditValue", issue.title)
    },
    setActiveSprintGroupBy(groupBy) {
      setState("activeSprintGroupBy", groupBy)
    },
    setKanbanGroupBy(groupBy) {
      setState("kanbanGroupBy", groupBy)
    },
    setBacklogGroupBy(groupBy) {
      setState("backlogGroupBy", groupBy)
    },
    setActiveSprintStatusOffset(offset) {
      setState("activeSprintStatusOffset", clampOffset(offset, state.statuses.length))
    },
    setKanbanStatusOffset(offset) {
      setState("kanbanStatusOffset", clampOffset(offset, state.statuses.length))
    },
  }

  return <AppStateContextProvider value={context}>{props.children}</AppStateContextProvider>
}

function clampOffset(offset: number, statusCount: number) {
  return Math.max(0, Math.min(offset, Math.max(0, statusCount - 1)))
}

export function detailBodyInitialValue(state: AppState, issue: IssueSummary) {
  return state.issueDrafts[issue.key]?.description ?? issue.description
}
