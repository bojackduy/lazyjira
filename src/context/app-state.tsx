import { createStore, reconcile } from "solid-js/store"
import { createRequiredContext, type ProviderProps } from "./helper"
import { loadJiraAuthConfig, normalizeBaseUrl, saveJiraAuthConfig, saveJiraWorkspaceConfig } from "../auth/config"
import { fetchAccessibleProjects, fetchProjectBoards } from "../jira/client"
import type { AppState, AuthOnboardingStep, BacklogGroupBy, BoardGroupBy, BoardOption, ConfigDraft, ConfigFocusArea, ConfigSectionId, FocusPane, IssueSummary, ProjectOption, QuickFilterId, StatusCategory } from "../state/app-state"
import {
  colorableConfigSection,
  configDraftSummary,
  configRowIds,
  configSectionIdAt,
  configSectionIds,
  configuredIssueTypes,
  configuredStatuses,
  normalizedColor,
  selectedConfigTargetId,
  writableConfigSection,
} from "../state/config-drafts"
import { sidebarRoutes, type AppRoute } from "../state/routes"
import { issueByKey } from "../state/issue-drafts"
import { isEditableField, issueFieldDisplayValue, issueFields, selectedIssueField } from "../state/issue-fields"
import { discardedActiveEditors, stagedChanges, stagedDiscardTargetIds } from "../state/staged-changes"
import { workspaceCurrentResults, workspaceItems, workspaceSelectedItem } from "../state/workspace"
import { useToast } from "./toast"

export type AppStateContext = {
  state: AppState
  openAuthOnboarding: () => void
  closeAuthOnboarding: () => void
  updateAuthOnboardingValue: (value: string) => void
  submitAuthOnboarding: () => Promise<void>
  openProjectPicker: () => void
  closeProjectPicker: () => void
  refreshProjectPicker: () => Promise<void>
  backProjectPickerStep: () => void
  moveProjectPickerSelection: (delta: number) => void
  selectProjectPickerItem: () => Promise<void>
  setRoute: (route: AppRoute) => void
  setFocusedPane: (pane: FocusPane) => void
  focusNextPane: (delta: 1 | -1) => void
  moveSidebarSelection: (delta: number) => void
  openSidebarSelection: () => void
  toggleSidebarFilterSelection: () => void
  toggleQuickFilter: (filterId: QuickFilterId) => void
  moveWorkspaceSelection: (delta: number) => void
  openWorkspaceSelection: () => void
  focusWorkspaceResults: () => void
  closeWorkspaceResults: () => void
  openSearch: () => void
  closeSearch: () => void
  updateSearchDraft: (value: string) => void
  commitSearch: () => void
  clearSearch: () => void
  moveConfigSelection: (delta: number) => void
  focusConfigArea: (area: ConfigFocusArea) => void
  startConfigAdd: () => void
  startConfigRename: () => void
  startConfigColor: () => void
  updateConfigEditValue: (value: string) => void
  commitConfigEdit: () => void
  cancelConfigEdit: () => void
  stageConfigRemove: () => void
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

  async function saveSelectedProjectContext(project: ProjectOption, board: BoardOption) {
    setState("projectPicker", "saving", true)
    try {
      await saveJiraWorkspaceConfig({
        projectKey: project.key,
        projectName: project.name,
        boardId: board.id,
        boardName: board.name,
        boardType: board.type,
      })
      setState("project", { key: project.key, name: project.name })
      setState("board", { id: board.id, name: board.name, type: board.type })
      setState("jiraProjectReady", true)
      setState("projectPicker", "open", false)
      setState("projectPicker", "error", undefined)
      toast.show(`Project ${project.key} selected. Jira data fetch can be wired next.`)
    } finally {
      setState("projectPicker", "saving", false)
      setState("projectPicker", "loading", false)
    }
  }

  const context: AppStateContext = {
    state,
    openAuthOnboarding() {
      setState("authOnboarding", "open", true)
      setState("authOnboarding", "error", undefined)
    },
    closeAuthOnboarding() {
      setState("authOnboarding", "open", false)
      setState("authOnboarding", "saving", false)
      setState("authOnboarding", "error", undefined)
      setState("authOnboarding", "apiToken", "")
    },
    updateAuthOnboardingValue(value) {
      setState("authOnboarding", authOnboardingField(state.authOnboarding.step), value)
      setState("authOnboarding", "error", undefined)
    },
    async submitAuthOnboarding() {
      if (state.authOnboarding.saving) return
      try {
        const step = state.authOnboarding.step
        if (step === "baseUrl") {
          setState("authOnboarding", "baseUrl", normalizeBaseUrl(state.authOnboarding.baseUrl))
          setState("authOnboarding", "step", "email")
          setState("authOnboarding", "error", undefined)
          return
        }
        if (step === "email") {
          const email = state.authOnboarding.email.trim()
          if (!email) throw new Error("Jira email is required")
          setState("authOnboarding", "email", email)
          setState("authOnboarding", "step", "apiToken")
          setState("authOnboarding", "error", undefined)
          return
        }

        setState("authOnboarding", "saving", true)
        await saveJiraAuthConfig({
          baseUrl: state.authOnboarding.baseUrl,
          email: state.authOnboarding.email,
          apiToken: state.authOnboarding.apiToken,
        })
        setState("jiraAuthReady", true)
        setState("authOnboarding", "open", false)
        setState("authOnboarding", "saving", false)
        setState("authOnboarding", "error", undefined)
        setState("authOnboarding", "apiToken", "")
        setState("projectPicker", "open", true)
        setState("projectPicker", "step", "project")
        setState("projectPicker", "selectedIndex", 0)
        toast.show("Jira credentials saved. Choose a project next.")
        void context.refreshProjectPicker()
      } catch (error) {
        setState("authOnboarding", "saving", false)
        setState("authOnboarding", "error", error instanceof Error ? error.message : String(error))
      }
    },
    openProjectPicker() {
      if (!state.jiraAuthReady) {
        context.openAuthOnboarding()
        return
      }
      setState("projectPicker", "open", true)
      setState("projectPicker", "step", "project")
      setState("projectPicker", "error", undefined)
      setState("projectPicker", "selectedIndex", 0)
      if (!state.projectPicker.projects.length) void context.refreshProjectPicker()
    },
    closeProjectPicker() {
      setState("projectPicker", "open", false)
      setState("projectPicker", "loading", false)
      setState("projectPicker", "saving", false)
      setState("projectPicker", "error", undefined)
    },
    async refreshProjectPicker() {
      if (state.projectPicker.loading) return
      setState("projectPicker", "loading", true)
      setState("projectPicker", "error", undefined)
      try {
        const auth = await loadJiraAuthConfig()
        if (!auth) {
          setState("projectPicker", "open", false)
          context.openAuthOnboarding()
          return
        }
        if (state.projectPicker.step === "board" && state.projectPicker.selectedProject) {
          const boards = await fetchProjectBoards(auth, state.projectPicker.selectedProject.key)
          setState("projectPicker", "boards", boards)
          setState("projectPicker", "selectedIndex", 0)
          if (!boards.length) setState("projectPicker", "error", `No Jira Software boards found for ${state.projectPicker.selectedProject.key}`)
          return
        }
        const projects = await fetchAccessibleProjects(auth)
        setState("projectPicker", "projects", projects)
        setState("projectPicker", "selectedIndex", 0)
        if (!projects.length) setState("projectPicker", "error", "No accessible Jira projects found")
      } catch (error) {
        setState("projectPicker", "error", error instanceof Error ? error.message : String(error))
      } finally {
        setState("projectPicker", "loading", false)
      }
    },
    backProjectPickerStep() {
      if (state.projectPicker.step !== "board") return
      const selectedProject = state.projectPicker.selectedProject
      const selectedIndex = selectedProject ? Math.max(0, state.projectPicker.projects.findIndex((project) => project.key === selectedProject.key)) : 0
      setState("projectPicker", "step", "project")
      setState("projectPicker", "selectedProject", undefined)
      setState("projectPicker", "boards", [])
      setState("projectPicker", "selectedIndex", selectedIndex)
      setState("projectPicker", "error", undefined)
    },
    moveProjectPickerSelection(delta) {
      const options = projectPickerOptions(state)
      if (!options.length) return
      setState("projectPicker", "selectedIndex", (state.projectPicker.selectedIndex + delta + options.length) % options.length)
    },
    async selectProjectPickerItem() {
      if (state.projectPicker.loading || state.projectPicker.saving) return
      try {
        const auth = await loadJiraAuthConfig()
        if (!auth) {
          setState("projectPicker", "open", false)
          context.openAuthOnboarding()
          return
        }
        if (state.projectPicker.step === "project") {
          const project = state.projectPicker.projects[state.projectPicker.selectedIndex]
          if (!project) return
          setState("projectPicker", "loading", true)
          setState("projectPicker", "error", undefined)
          const boards = await fetchProjectBoards(auth, project.key)
          if (!boards.length) {
            setState("projectPicker", "error", `No Jira Software boards found for ${project.key}`)
            return
          }
          if (boards.length === 1) {
            await saveSelectedProjectContext(project, boards[0]!)
            return
          }
          setState("projectPicker", "selectedProject", project)
          setState("projectPicker", "boards", boards)
          setState("projectPicker", "step", "board")
          setState("projectPicker", "selectedIndex", 0)
          return
        }

        const project = state.projectPicker.selectedProject
        const board = state.projectPicker.boards[state.projectPicker.selectedIndex]
        if (!project || !board) return
        await saveSelectedProjectContext(project, board)
      } catch (error) {
        setState("projectPicker", "error", error instanceof Error ? error.message : String(error))
      } finally {
        setState("projectPicker", "loading", false)
      }
    },
    setRoute(route) {
      setState("route", route)
      const index = sidebarRoutes.findIndex((candidate) => candidate.id === route)
      if (index !== -1) setState("sidebarSelectedIndex", index)
      if (route === "issue-detail") setState("focusedPane", "main")
      if (route === "workspace") setState("focusedPane", "main")
      if (route === "config") setState("focusedPane", "main")
      if (route !== "workspace") setState("workspaceFocusedArea", "cards")
      if (route !== "issue-detail") setState("previousRoute", undefined)
    },
    setFocusedPane(pane) {
      setState("focusedPane", pane)
    },
    focusNextPane(delta) {
      const panes: FocusPane[] = state.route === "workspace" || state.route === "config" ? ["sidebar", "main"] : ["sidebar", "main", "inspector"]
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
    moveWorkspaceSelection(delta) {
      if (state.workspaceFocusedArea === "results") {
        const results = workspaceCurrentResults(state)
        if (!results.length) return
        setState("workspaceResultSelectedIndex", (state.workspaceResultSelectedIndex + delta + results.length) % results.length)
        return
      }
      const items = workspaceItems(state)
      if (!items.length) return
      setState("workspaceSelectedIndex", (state.workspaceSelectedIndex + delta + items.length) % items.length)
      setState("workspaceResultSelectedIndex", 0)
    },
    openWorkspaceSelection() {
      if (state.workspaceFocusedArea === "results") {
        const result = workspaceCurrentResults(state)[state.workspaceResultSelectedIndex]
        if (result?.issueKey) context.openIssueDetail(result.issueKey)
        return
      }
      const item = workspaceSelectedItem(state)
      if (!item) return
      if (item.route) {
        context.setRoute(item.route)
        return
      }
      if (item.issueKey) context.openIssueDetail(item.issueKey)
      else context.focusWorkspaceResults()
    },
    focusWorkspaceResults() {
      const results = workspaceCurrentResults(state)
      if (!results.length) return
      setState("workspaceFocusedArea", "results")
      setState("workspaceResultSelectedIndex", 0)
    },
    closeWorkspaceResults() {
      setState("workspaceFocusedArea", "cards")
      setState("workspaceResultSelectedIndex", 0)
    },
    openSearch() {
      setState("searchOpen", true)
      setState("searchDraft", state.searchQuery)
      setState("focusedPane", "main")
    },
    closeSearch() {
      setState("searchOpen", false)
      setState("searchDraft", state.searchQuery)
    },
    updateSearchDraft(value) {
      setState("searchDraft", value)
    },
    commitSearch() {
      setState("searchQuery", state.searchDraft.trim())
      setState("searchOpen", false)
    },
    clearSearch() {
      setState("searchQuery", "")
      setState("searchDraft", "")
      setState("searchOpen", false)
    },
    moveConfigSelection(delta) {
      const sectionId = configSectionIdAt(state.configSelectedSectionIndex)
      if (state.configFocusedArea === "rows") {
        const rows = configRowIds(state, sectionId)
        if (!rows.length) return
        setState("configSelectedRowIndex", (state.configSelectedRowIndex + delta + rows.length) % rows.length)
        return
      }
      const nextIndex = (state.configSelectedSectionIndex + delta + configSectionIds.length) % configSectionIds.length
      setState("configSelectedSectionIndex", nextIndex)
      setState("configSelectedRowIndex", 0)
    },
    focusConfigArea(area) {
      if (area === "rows" && !configRowIds(state, configSectionIdAt(state.configSelectedSectionIndex)).length) return
      setState("configFocusedArea", area)
    },
    startConfigAdd() {
      const sectionId = configSectionIdAt(state.configSelectedSectionIndex)
      if (!writableConfigSection(sectionId)) {
        toast.show("This config section is read-only until Jira metadata writes are modeled")
        return
      }
      setState("configEditing", { action: "add", sectionId })
      setState("configEditValue", "")
      setState("configFocusedArea", "rows")
    },
    startConfigRename() {
      const sectionId = configSectionIdAt(state.configSelectedSectionIndex)
      const targetId = selectedConfigTargetId(state)
      if (!writableConfigSection(sectionId) || !targetId) {
        toast.show("Select a writable config row first")
        return
      }
      setState("configEditing", { action: "rename", sectionId, targetId })
      setState("configEditValue", configTargetName(state, sectionId, targetId))
      setState("configFocusedArea", "rows")
    },
    startConfigColor() {
      const sectionId = configSectionIdAt(state.configSelectedSectionIndex)
      const targetId = selectedConfigTargetId(state)
      if (!colorableConfigSection(sectionId) || !targetId) {
        toast.show("Select a colorable config row first")
        return
      }
      setState("configEditing", { action: "color", sectionId, targetId })
      setState("configEditValue", configTargetColor(state, sectionId, targetId))
      setState("configFocusedArea", "rows")
    },
    updateConfigEditValue(value) {
      setState("configEditValue", value)
    },
    commitConfigEdit() {
      const draft = configDraftFromEdit(state)
      if (!draft) {
        toast.show(state.configEditing?.action === "color" ? "Use a #RRGGBB color value" : "Enter a config name first")
        return
      }
      setState("configDrafts", (drafts) => [...drafts, draft])
      setState("configDraftCounter", state.configDraftCounter + 1)
      setState("configEditing", undefined)
      setState("configEditValue", "")
      toast.show(`${configDraftSummary(draft)} staged`)
    },
    cancelConfigEdit() {
      setState("configEditing", undefined)
      setState("configEditValue", "")
    },
    stageConfigRemove() {
      const sectionId = configSectionIdAt(state.configSelectedSectionIndex)
      const targetId = selectedConfigTargetId(state)
      if (!isWritableConfigSection(sectionId) || !targetId) {
        toast.show("Select a writable config row first")
        return
      }
      const draft: ConfigDraft = { id: nextConfigDraftId(state), sectionId, action: "remove", targetId }
      setState("configDrafts", (drafts) => [...drafts, draft])
      setState("configDraftCounter", state.configDraftCounter + 1)
      setState("configEditing", undefined)
      setState("configEditValue", "")
      toast.show(`${configDraftSummary(draft)} staged`)
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
      const choices = fieldId === "statusId" ? configuredStatuses(state).map((status) => status.id) : configuredIssueTypes(state).map((type) => type.id)
      if (!choices.length) return
      const currentIndex = Math.max(0, choices.findIndex((choice) => choice === state.inspectorEditValue))
      setState("inspectorEditValue", choices[(currentIndex + delta + choices.length) % choices.length]!)
    },
    startInspectorEdit() {
      const issue = issueByKey(state, state.selectedIssueKey)
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
      const drafts = { ...state.issueDrafts }
      if (Object.keys(draft).length) drafts[issueKey] = draft
      else delete drafts[issueKey]
      setState("issueDrafts", reconcile(drafts))
      if (state.inspectorEditingFieldId === field.id) context.cancelInspectorEdit()
    },
    requestIssueDelete() {
      if (state.route === "workspace" || state.route === "config") return
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
      setState("issueDrafts", reconcile(drafts))
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
      const issue = issueByKey(state, state.selectedIssueKey)
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
      const selectedIds = stagedDiscardTargetIds(changes, state.stagedDiscardSelectedIndex, state.stagedDiscardSelections)
      if (!selectedIds.size) {
        context.closeStagedDiscard()
        toast.show("No staged changes to discard")
        return
      }
      let discardedCount = 0
      const editorsToClear = discardedActiveEditors(changes, selectedIds, state.selectedIssueKey, state.inspectorEditingFieldId, state.detailBodyEditing)
      const issueDrafts = { ...state.issueDrafts }
      let issueDeletes = [...state.issueDeletes]
      let configDrafts = [...state.configDrafts]
      for (const change of changes) {
        if (!selectedIds.has(change.id)) continue
        discardedCount += 1
        if (change.kind === "config") {
          configDrafts = configDrafts.filter((draft) => draft.id !== change.draftId)
          continue
        }
        if (change.kind === "delete") {
          issueDeletes = issueDeletes.filter((issueKey) => issueKey !== change.issueKey)
          continue
        }
        const draft = { ...(issueDrafts[change.issueKey] ?? {}) }
        delete draft[change.fieldId]
        if (Object.keys(draft).length) issueDrafts[change.issueKey] = draft
        else delete issueDrafts[change.issueKey]
      }
      setState("issueDrafts", reconcile(issueDrafts))
      setState("issueDeletes", issueDeletes)
      setState("configDrafts", reconcile(configDrafts))
      if (editorsToClear.inspector) {
        setState("inspectorEditingFieldId", undefined)
        setState("inspectorEditValue", "")
      }
      if (editorsToClear.detailBody) {
        setState("detailBodyEditing", false)
        setState("detailBodyEditValue", "")
      }
      context.closeStagedDiscard()
      toast.show(`Discarded ${discardedCount} staged change${discardedCount === 1 ? "" : "s"}`)
    },
    applyIssueChanges() {
      const changeCount = stagedChanges(state).length
      if (!changeCount) {
        toast.show("No staged changes to render")
        return
      }
      setState("pendingDeleteIssueKey", undefined)
      setState("remoteApplyOpen", false)
      setState("stagedDiscardOpen", false)
      setState("stagedDiscardSelectedIndex", 0)
      setState("stagedDiscardSelections", [])
      setState("inspectorEditingFieldId", undefined)
      setState("inspectorEditValue", "")
      setState("detailBodyEditing", false)
      setState("detailBodyEditValue", "")
      setState("configEditing", undefined)
      setState("configEditValue", "")
      toast.show(`${changeCount} staged change${changeCount === 1 ? "" : "s"} rendered; X can discard, W writes Jira`)
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
      setState("activeSprintStatusOffset", clampOffset(offset, configuredStatuses(state).length))
    },
    setKanbanStatusOffset(offset) {
      setState("kanbanStatusOffset", clampOffset(offset, configuredStatuses(state).length))
    },
  }

  return <AppStateContextProvider value={context}>{props.children}</AppStateContextProvider>
}

function clampOffset(offset: number, statusCount: number) {
  return Math.max(0, Math.min(offset, Math.max(0, statusCount - 1)))
}

function projectPickerOptions(state: AppState) {
  return state.projectPicker.step === "project" ? state.projectPicker.projects : state.projectPicker.boards
}

export function detailBodyInitialValue(state: AppState, issue: IssueSummary) {
  return state.issueDrafts[issue.key]?.description ?? issue.description
}

function configDraftFromEdit(state: AppState): ConfigDraft | undefined {
  const editing = state.configEditing
  if (!editing || !isWritableConfigSection(editing.sectionId)) return
  const value = state.configEditValue.trim()
  if (editing.action === "color") {
    const color = normalizedColor(value)
    if (!color || !editing.targetId) return
    return { id: nextConfigDraftId(state), sectionId: editing.sectionId, action: "color", targetId: editing.targetId, color }
  }
  if (!value) return
  if (editing.action === "add") {
    return {
      id: nextConfigDraftId(state),
      sectionId: editing.sectionId,
      action: "add",
      name: value,
      color: defaultConfigColor(editing.sectionId),
      category: defaultStatusCategory(state, editing.sectionId),
    }
  }
  if (!editing.targetId) return
  return { id: nextConfigDraftId(state), sectionId: editing.sectionId, action: "rename", targetId: editing.targetId, name: value }
}

function nextConfigDraftId(state: AppState) {
  return `config-${state.configDraftCounter}`
}

function isWritableConfigSection(sectionId: ConfigSectionId): sectionId is ConfigDraft["sectionId"] {
  return writableConfigSection(sectionId)
}

function configTargetName(state: AppState, sectionId: ConfigSectionId, targetId: string) {
  if (sectionId === "issue-types") return configuredIssueTypes(state).find((type) => type.id === targetId)?.name ?? targetId
  return configuredStatuses(state).find((status) => status.id === targetId)?.name ?? targetId
}

function configTargetColor(state: AppState, sectionId: ConfigSectionId, targetId: string) {
  if (sectionId === "issue-types") return configuredIssueTypes(state).find((type) => type.id === targetId)?.color ?? "#3B82F6"
  return configuredStatuses(state).find((status) => status.id === targetId)?.color ?? "#64748B"
}

function defaultConfigColor(sectionId: ConfigDraft["sectionId"]) {
  return sectionId === "issue-types" ? "#3B82F6" : "#64748B"
}

function defaultStatusCategory(state: AppState, sectionId: ConfigDraft["sectionId"]): StatusCategory | undefined {
  if (sectionId === "issue-types") return
  const targetId = selectedConfigTargetId(state)
  return configuredStatuses(state).find((status) => status.id === targetId)?.category ?? "todo"
}

function authOnboardingField(step: AuthOnboardingStep): "baseUrl" | "email" | "apiToken" {
  return step
}
