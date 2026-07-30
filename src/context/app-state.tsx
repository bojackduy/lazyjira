import { onMount } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { createRequiredContext, type ProviderProps } from "./helper"
import { normalizeBaseUrl, saveJiraAuthConfig, type JiraWorkspaceConfig } from "../auth/config"
import { workspaceStats, type WorkspaceSelection, type WorkspaceSource, type LoadedWorkspace } from "../workspace/types"
import type { AppState, AuthOnboardingStep, BacklogGroupBy, BoardGroupBy, BoardLocation, BoardMode, BoardOption, ConfigDraft, ConfigFocusArea, ConfigSectionId, FocusPane, IssueEditableField, IssueSummary, JiraUserOption, ProjectOption, QuickFilterId, StatusCategory, WorkspaceOption } from "../state/app-state"
import {
  colorableConfigSection,
  configuredColumns,
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
import { defaultIssueTypeColor, statusColorForCategory } from "../state/metadata-colors"
import { sidebarRoutes, type AppRoute } from "../state/routes"
import { issueByKey } from "../state/issue-drafts"
import { isEditableField, issueFieldDisplayValue, issueFields, parentIssueChoices, selectedIssueField } from "../state/issue-fields"
import { filteredProjectPickerBoards, filteredProjectPickerOptions, filteredProjectPickerProjects, filteredProjectPickerWorkspaces } from "../state/project-picker"
import { discardedActiveEditors, stagedChanges, stagedDiscardTargetIds } from "../state/staged-changes"
import { workspaceCurrentResults, workspaceItems, workspaceSelectedItem } from "../state/workspace"
import { defaultIssuePageState, remoteSearchIssuePageSourceId } from "../state/issue-pages"
import { planJiraWrites, writePlanCounts } from "../state/jira-write-plan"
import { markdownToAdf } from "../jira/adf"
import { useToast } from "./toast"

export type AppStateContext = {
  state: AppState
  openAuthOnboarding: () => void
  closeAuthOnboarding: () => void
  updateAuthOnboardingValue: (value: string) => void
  submitAuthOnboarding: () => Promise<void>
  openProjectPicker: () => void
  closeProjectPicker: () => void
  browseRemoteProjects: () => Promise<void>
  refreshProjectPicker: () => Promise<void>
  openProjectPickerSearch: () => void
  updateProjectPickerSearch: (query: string) => void
  clearProjectPickerSearch: () => void
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
  openCommandPalette: () => void
  closeCommandPalette: () => void
  updateCommandPaletteQuery: (query: string) => void
  moveCommandPaletteSelection: (delta: number, resultCount: number) => void
  openHelp: () => void
  closeHelp: () => void
  openSearch: () => void
  openRemoteSearch: () => void
  closeSearch: () => void
  updateSearchDraft: (value: string) => void
  commitSearch: () => void
  clearSearch: () => void
  loadMoreRemoteSearch: () => Promise<void>
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
  loadIssueDetail: (issueKey?: string) => Promise<void>
  loadIssuePage: (sourceId: string) => Promise<void>
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
  confirmRemoteIssueApply: () => Promise<void>
  refreshWorkspace: () => void
  retryWorkspaceLoad: () => void
  startDetailBodyEdit: () => void
  updateDetailBodyEditValue: (value: string) => void
  commitDetailBodyEdit: () => void
  cancelDetailBodyEdit: () => void
  startComment: () => void
  updateCommentValue: (value: string) => void
  commitComment: () => void
  cancelComment: () => void
  stageIssueRank: (issueKey: string, targetIssueKey: string, position: "before" | "after") => void
  openStagedDiscard: () => void
  closeStagedDiscard: () => void
  moveStagedDiscardSelection: (delta: number) => void
  toggleStagedDiscardSelection: () => void
  confirmStagedDiscard: () => void
  applyIssueChanges: () => void
  createDraftIssue: (issue: IssueSummary) => void
  setSelectedBoardLocation: (mode: BoardMode, location: BoardLocation | undefined) => void
  setActiveSprintGroupBy: (groupBy: BoardGroupBy) => void
  setKanbanGroupBy: (groupBy: BoardGroupBy) => void
  setBacklogGroupBy: (groupBy: BacklogGroupBy) => void
  setSelectedBacklogGroup: (groupId: string) => void
  setActiveSprintStatusOffset: (offset: number) => void
  setKanbanStatusOffset: (offset: number) => void
}

const [AppStateContextProvider, useAppState] = createRequiredContext<AppStateContext>("AppState")

export { useAppState }

export function AppStateProvider(props: ProviderProps<{ initialState: AppState; initialWorkspaceSelection?: WorkspaceSelection; source: WorkspaceSource; saveWorkspaceConfig: (workspace: JiraWorkspaceConfig) => Promise<unknown> }>) {
  const [state, setState] = createStore<AppState>(props.initialState)
  const toast = useToast()
  let userPickerTimer: ReturnType<typeof setTimeout> | undefined
  let userPickerRequestId = 0

  async function loadWorkspace(selection: WorkspaceSelection, applyOnSuccess: boolean) {
    const requestId = state.workspaceRequestId + 1
    setState("workspaceRequestId", requestId)
    setState("workspaceLoading", true)
    setState("workspaceLoadError", undefined)
    try {
      const workspace = await props.source.loadWorkspace(selection)
      if (state.workspaceRequestId !== requestId) return undefined
      if (applyOnSuccess) applyLoadedWorkspace(workspace)
      return workspace
    } catch (error) {
      if (state.workspaceRequestId !== requestId) return undefined
      const message = error instanceof Error ? error.message : String(error)
      setState("workspaceLoadError", message)
      toast.show(message)
      return undefined
    } finally {
      if (state.workspaceRequestId === requestId) setState("workspaceLoading", false)
    }
  }

  onMount(() => {
    if (props.initialWorkspaceSelection) void loadWorkspace(props.initialWorkspaceSelection, true)
  })

  async function saveSelectedWorkspaceContext(workspace: WorkspaceOption) {
    await saveSelectedProjectContext(
      { id: workspace.projectKey, key: workspace.projectKey, name: workspace.projectName },
      { id: workspace.boardId, name: workspace.boardName, type: workspace.boardType },
    )
  }

  async function saveSelectedProjectContext(project: ProjectOption, board: BoardOption) {
    const selectedWorkspace = workspaceOptionFromContext(project, board)
    const active = isActiveWorkspace(state, project, board)
    if (active && state.jiraProjectReady && !state.workspaceLoadError && hasRecentWorkspace(state, selectedWorkspace)) {
      setState("projectPicker", "open", false)
      toast.show(`${project.key} · ${board.name} is already active.`)
      return
    }
    if (!active && stagedChanges(state).length) {
      setState("projectPicker", "error", "Discard staged changes before switching workspaces.")
      return
    }
    setState("projectPicker", "saving", true)
    try {
      const shouldLoad = !active || !!state.workspaceLoadError
      const workspace = shouldLoad ? await loadWorkspace({
        project: { key: project.key, name: project.name },
        board: { id: board.id, name: board.name, type: board.type },
      }, false) : undefined
      if (shouldLoad && !workspace) {
        setState("projectPicker", "error", state.workspaceLoadError ?? "Jira workspace load did not complete")
        return
      }
      await props.saveWorkspaceConfig({
        projectKey: project.key,
        projectName: project.name,
        boardId: board.id,
        boardName: board.name,
        boardType: board.type,
      })
      if (workspace) applyLoadedWorkspace(workspace)
      setState("recentWorkspaces", reconcile(recentWorkspacesWith(selectedWorkspace, state.recentWorkspaces)))
      setState("jiraProjectReady", true)
      setState("workspaceLoadError", undefined)
      setState("projectPicker", "open", false)
      setState("projectPicker", "error", undefined)
      toast.show(active ? `${project.key} · ${board.name} saved to recent workspaces.` : props.source.env === "dev" ? `Dev project ${project.key} loaded from fixtures.` : `Prod project ${project.key} loaded from Jira.`)
    } finally {
      setState("projectPicker", "saving", false)
      setState("projectPicker", "loading", false)
    }
  }

  function applyLoadedWorkspace(workspace: LoadedWorkspace) {
    setState("project", workspace.project)
    setState("board", workspace.board)
    setState("workspaceLoadError", undefined)
    setState("workspaceNotice", workspace.notice)
    setState("currentUser", workspace.currentUser)
    setState("quickFilters", reconcile(workspace.quickFilters))
    setState("activeQuickFilters", [])
    setState("activeSprintId", workspace.activeSprintId)
    setState("sprints", reconcile(workspace.sprints))
    setState("statuses", reconcile(workspace.statuses))
    setState("issueTypes", reconcile(workspace.issueTypes))
    setState("columns", reconcile(workspace.columns))
    setState("issues", reconcile(workspace.issues))
    setState("stats", workspace.stats)
    setState("selectedIssueKey", workspace.selectedIssueKey)
    setState("selectedBoardLocations", {})
    setState("workspaceSelectedIndex", 0)
    setState("workspaceFocusedArea", "cards")
    setState("workspaceResultSelectedIndex", 0)
    setState("commandPaletteOpen", false)
    setState("commandPaletteQuery", "")
    setState("commandPaletteSelectedIndex", 0)
    setState("helpOpen", false)
    setState("searchOpen", false)
    setState("searchMode", "loaded")
    setState("searchQuery", "")
    setState("searchDraft", "")
    setState("remoteSearchQuery", "")
    setState("remoteSearchIssueKeys", [])
    setState("remoteSearchPageState", defaultIssuePageState(remoteSearchIssuePageSourceId, 50))
    setState("remoteSearchRequestId", 0)
    setState("issueDrafts", reconcile({}))
    setState("commentDrafts", [])
    setState("commentEditing", false)
    setState("commentEditValue", "")
    setState("rankDrafts", reconcile({}))
    setState("issueDeletes", [])
    setState("issueDetailLoadingByKey", reconcile({}))
    setState("issueDetailErrorByKey", reconcile({}))
    setState("issueDetailLoadedAtByKey", reconcile({}))
    setState("issueDetailRequestId", 0)
    setState("issuePageStateBySource", reconcile(workspace.issuePageStateBySource))
    setState("issuePageRequestIdBySource", reconcile({}))
    setState("pendingDeleteIssueKey", undefined)
    setState("inspectorSelectedFieldIndex", 1)
    setState("inspectorEditingFieldId", undefined)
    setState("inspectorEditValue", "")
    setState("inspectorUserPicker", undefined)
    setState("userDraftAccountIds", reconcile({}))
    setState("detailBodyEditing", false)
    setState("detailBodyEditValue", "")
    setState("remoteApplyOpen", false)
    setState("remoteApplyApplying", false)
    setState("remoteDeleteConfirmationArmed", false)
    setState("stagedDiscardOpen", false)
    setState("stagedDiscardSelectedIndex", 0)
    setState("stagedDiscardSelections", [])
    setState("activeSprintStatusOffset", 0)
    setState("kanbanStatusOffset", 0)
    setState("selectedBacklogGroupId", workspace.activeSprintId || "backlog")
  }

  async function runRemoteSearch(query: string, append: boolean) {
    const trimmed = query.trim()
    if (!trimmed) {
      context.clearSearch()
      return
    }
    if (state.remoteSearchPageState.loading) return
    if (append && state.remoteSearchPageState.isLast) {
      toast.show("No more Jira search results to load")
      return
    }
    const pageState = append && state.remoteSearchQuery === trimmed
      ? state.remoteSearchPageState
      : defaultIssuePageState(remoteSearchIssuePageSourceId, 50)
    const requestId = state.remoteSearchRequestId + 1
    setState("remoteSearchRequestId", requestId)
    setState("searchMode", "remote")
    setState("remoteSearchQuery", trimmed)
    setState("remoteSearchPageState", { ...pageState, loading: true, error: undefined })
    if (!append) setState("remoteSearchIssueKeys", [])
    try {
      const loaded = await props.source.searchIssues(trimmed, {
        project: state.project,
        board: state.board,
        statuses: state.statuses,
        pageState,
      })
      if (state.remoteSearchRequestId !== requestId) return
      const nextIssues = { ...state.issues }
      for (const issue of loaded.issues) nextIssues[issue.key] = mergeLoadedPageIssue(nextIssues[issue.key], issue)
      const nextKeys = uniqueStrings([...(append ? state.remoteSearchIssueKeys : []), ...loaded.issues.map((issue) => issue.key)])
      setState("issues", reconcile(nextIssues))
      setState("stats", workspaceStats(state.statuses, Object.values(nextIssues)))
      setState("remoteSearchIssueKeys", nextKeys)
      setState("remoteSearchPageState", reconcile({ ...loaded.pageState, loading: false, error: undefined }))
      setState("searchOpen", false)
      setState("searchDraft", trimmed)
      setState("route", "workspace")
      setState("sidebarSelectedIndex", sidebarRoutes.findIndex((route) => route.id === "workspace"))
      setState("workspaceFocusedArea", "cards")
      setState("workspaceSelectedIndex", remoteSearchWorkspaceItemIndex(state))
      setState("workspaceResultSelectedIndex", 0)
    } catch (error) {
      if (state.remoteSearchRequestId !== requestId) return
      const message = error instanceof Error ? error.message : String(error)
      setState("remoteSearchPageState", { ...pageState, loading: false, error: message })
      setState("searchOpen", false)
      toast.show(message)
    }
  }

  function scheduleInspectorUserPicker(fieldId: "assignee" | "reporter", issueKey: string, query: string, delay = 0) {
    if (userPickerTimer) clearTimeout(userPickerTimer)
    const requestId = ++userPickerRequestId
    userPickerTimer = setTimeout(() => void loadInspectorUserPicker(fieldId, issueKey, query, requestId), delay)
  }

  async function loadInspectorUserPicker(fieldId: "assignee" | "reporter", issueKey: string, query: string, requestId: number) {
    try {
      const options = await props.source.loadUserPicker(fieldId, issueKey, state.project.key, query)
      const picker = state.inspectorUserPicker
      if (!picker || picker.fieldId !== fieldId || picker.issueKey !== issueKey || picker.query !== query || requestId !== userPickerRequestId) return
      const filtered = filterJiraUsers(options, picker.query)
      const currentIndex = Math.max(0, filtered.findIndex((user) => user.displayName === state.inspectorEditValue))
      setState("inspectorUserPicker", { ...picker, allOptions: options, options: filtered, selectedIndex: currentIndex, loading: false, error: undefined })
    } catch (error) {
      const picker = state.inspectorUserPicker
      if (!picker || picker.fieldId !== fieldId || picker.issueKey !== issueKey || picker.query !== query || requestId !== userPickerRequestId) return
      setState("inspectorUserPicker", { ...picker, options: [], selectedIndex: 0, loading: false, error: error instanceof Error ? error.message : String(error) })
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
        setState("projectPicker", "mode", "local")
        setState("projectPicker", "searchOpen", false)
        setState("projectPicker", "searchQuery", "")
        setState("projectPicker", "selectedIndex", 0)
        toast.show("Jira credentials saved. Press a in the workspace switcher to browse Jira projects.")
      } catch (error) {
        setState("authOnboarding", "saving", false)
        setState("authOnboarding", "error", error instanceof Error ? error.message : String(error))
      }
    },
    openProjectPicker() {
      setState("projectPicker", "open", true)
      setState("projectPicker", "mode", "local")
      setState("projectPicker", "error", undefined)
      setState("projectPicker", "searchOpen", false)
      setState("projectPicker", "searchQuery", "")
      setState("projectPicker", "selectedIndex", activeRecentWorkspaceIndex(state))
    },
    closeProjectPicker() {
      setState("projectPicker", "open", false)
      setState("projectPicker", "loading", false)
      setState("projectPicker", "saving", false)
      setState("projectPicker", "error", undefined)
      setState("projectPicker", "searchOpen", false)
      setState("projectPicker", "searchQuery", "")
      setState("projectPicker", "selectedIndex", 0)
      setState("projectPicker", "selectedProject", undefined)
    },
    async browseRemoteProjects() {
      if (!state.jiraAuthReady && props.source.env === "prod") {
        context.openAuthOnboarding()
        return
      }
      setState("projectPicker", "open", true)
      setState("projectPicker", "mode", "remote-projects")
      setState("projectPicker", "error", undefined)
      setState("projectPicker", "searchOpen", false)
      setState("projectPicker", "searchQuery", "")
      setState("projectPicker", "selectedIndex", 0)
      setState("projectPicker", "selectedProject", undefined)
      if (!state.projectPicker.remoteProjectCache) await context.refreshProjectPicker()
    },
    async refreshProjectPicker() {
      if (state.projectPicker.mode === "local") return
      if (state.projectPicker.loading) return
      setState("projectPicker", "loading", true)
      setState("projectPicker", "error", undefined)
      try {
        if (state.projectPicker.mode === "remote-boards" && state.projectPicker.selectedProject) {
          const boards = await props.source.fetchBoards(state.projectPicker.selectedProject.key)
          setState("projectPicker", "remoteBoardsByProject", state.projectPicker.selectedProject.key, boards)
          setState("projectPicker", "selectedIndex", 0)
          if (!boards.length) setState("projectPicker", "error", `No Jira Software boards found for ${state.projectPicker.selectedProject.key}`)
          return
        }
        const projects = await props.source.fetchProjects()
        setState("projectPicker", "remoteProjectCache", projects)
        setState("projectPicker", "selectedIndex", 0)
        if (!projects.length) setState("projectPicker", "error", "No accessible Jira projects found")
      } catch (error) {
        setState("projectPicker", "error", error instanceof Error ? error.message : String(error))
      } finally {
        setState("projectPicker", "loading", false)
      }
    },
    openProjectPickerSearch() {
      setState("projectPicker", "searchOpen", true)
    },
    updateProjectPickerSearch(query) {
      setState("projectPicker", "searchQuery", query)
      setState("projectPicker", "selectedIndex", 0)
    },
    clearProjectPickerSearch() {
      setState("projectPicker", "searchOpen", false)
      setState("projectPicker", "searchQuery", "")
      setState("projectPicker", "selectedIndex", 0)
    },
    backProjectPickerStep() {
      if (state.projectPicker.mode === "local") return
      if (state.projectPicker.mode === "remote-projects") {
        setState("projectPicker", "mode", "local")
        setState("projectPicker", "selectedProject", undefined)
        setState("projectPicker", "searchOpen", false)
        setState("projectPicker", "searchQuery", "")
        setState("projectPicker", "selectedIndex", activeRecentWorkspaceIndex(state))
        setState("projectPicker", "error", undefined)
        return
      }
      const selectedProject = state.projectPicker.selectedProject
      setState("projectPicker", "mode", "remote-projects")
      setState("projectPicker", "selectedProject", undefined)
      setState("projectPicker", "searchOpen", false)
      setState("projectPicker", "searchQuery", "")
      const selectedIndex = selectedProject ? Math.max(0, filteredProjectPickerProjects(state).findIndex((project) => project.key === selectedProject.key)) : 0
      setState("projectPicker", "selectedIndex", selectedIndex)
      setState("projectPicker", "error", undefined)
    },
    moveProjectPickerSelection(delta) {
      const options = filteredProjectPickerOptions(state)
      if (!options.length) return
      setState("projectPicker", "selectedIndex", (state.projectPicker.selectedIndex + delta + options.length) % options.length)
    },
    async selectProjectPickerItem() {
      if (state.projectPicker.loading || state.projectPicker.saving) return
      try {
        if (state.projectPicker.mode === "local") {
          const workspace = filteredProjectPickerWorkspaces(state)[state.projectPicker.selectedIndex]
          if (!workspace) return
          await saveSelectedWorkspaceContext(workspace)
          return
        }

        if (state.projectPicker.mode === "remote-projects") {
          const project = filteredProjectPickerProjects(state)[state.projectPicker.selectedIndex]
          if (!project) return
          setState("projectPicker", "loading", true)
          setState("projectPicker", "error", undefined)
          const boards = state.projectPicker.remoteBoardsByProject[project.key] ?? await props.source.fetchBoards(project.key)
          setState("projectPicker", "remoteBoardsByProject", project.key, boards)
          if (!boards.length) {
            setState("projectPicker", "error", `No Jira Software boards found for ${project.key}`)
            return
          }
          setState("projectPicker", "selectedProject", project)
          setState("projectPicker", "mode", "remote-boards")
          setState("projectPicker", "searchOpen", false)
          setState("projectPicker", "searchQuery", "")
          setState("projectPicker", "selectedIndex", 0)
          return
        }

        const project = state.projectPicker.selectedProject
        const board = filteredProjectPickerBoards(state)[state.projectPicker.selectedIndex]
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
    openCommandPalette() {
      setState("commandPaletteQuery", "")
      setState("commandPaletteSelectedIndex", 0)
      setState("commandPaletteOpen", true)
    },
    closeCommandPalette() {
      setState("commandPaletteOpen", false)
      setState("commandPaletteQuery", "")
      setState("commandPaletteSelectedIndex", 0)
    },
    updateCommandPaletteQuery(query) {
      setState("commandPaletteQuery", query)
      setState("commandPaletteSelectedIndex", 0)
    },
    moveCommandPaletteSelection(delta, resultCount) {
      if (!resultCount) {
        setState("commandPaletteSelectedIndex", 0)
        return
      }
      setState("commandPaletteSelectedIndex", (state.commandPaletteSelectedIndex + delta + resultCount) % resultCount)
    },
    openHelp() {
      setState("helpOpen", true)
    },
    closeHelp() {
      setState("helpOpen", false)
    },
    openSearch() {
      setState("searchMode", "loaded")
      setState("searchOpen", true)
      setState("searchDraft", state.searchQuery)
      setState("focusedPane", "main")
    },
    openRemoteSearch() {
      setState("searchMode", "remote")
      setState("searchOpen", true)
      setState("searchDraft", state.remoteSearchQuery)
      setState("focusedPane", "main")
    },
    closeSearch() {
      setState("searchOpen", false)
      setState("searchDraft", state.searchMode === "remote" ? state.remoteSearchQuery : state.searchQuery)
    },
    updateSearchDraft(value) {
      setState("searchDraft", value)
    },
    commitSearch() {
      if (state.searchMode === "remote") {
        void runRemoteSearch(state.searchDraft.trim(), false)
        return
      }
      setState("searchQuery", state.searchDraft.trim())
      setState("searchOpen", false)
    },
    clearSearch() {
      if (state.searchMode === "remote") {
        setState("remoteSearchQuery", "")
        setState("remoteSearchIssueKeys", [])
        setState("remoteSearchPageState", defaultIssuePageState(remoteSearchIssuePageSourceId, 50))
        setState("searchDraft", "")
        setState("searchOpen", false)
        return
      }
      setState("searchQuery", "")
      setState("searchDraft", "")
      setState("searchOpen", false)
    },
    async loadMoreRemoteSearch() {
      await runRemoteSearch(state.remoteSearchQuery, true)
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
      const targetIssueKey = issueKey ?? state.selectedIssueKey
      if (issueKey) setState("selectedIssueKey", issueKey)
      if (state.route !== "issue-detail") setState("previousRoute", state.route)
      setState("route", "issue-detail")
      setState("focusedPane", "main")
      void context.loadIssueDetail(targetIssueKey)
    },
    async loadIssueDetail(issueKey = state.selectedIssueKey) {
      if (!issueKey) return
      const existingIssue = issueByKey(state, issueKey)
      if (existingIssue?.isDraft) return
      const requestId = state.issueDetailRequestId + 1
      setState("issueDetailRequestId", requestId)
      setState("issueDetailLoadingByKey", issueKey, true)
      setState("issueDetailErrorByKey", issueKey, undefined)
      try {
        const loaded = await props.source.loadIssueDetail(issueKey, {
          project: state.project,
          board: state.board,
          statuses: state.statuses,
          existingIssue,
        })
        if (state.issueDetailRequestId !== requestId) return
        setState("issues", loaded.issue.key, reconcile(loaded.issue))
        setState("issueDetailLoadedAtByKey", loaded.issue.key, new Date().toISOString())
      } catch (error) {
        if (state.issueDetailRequestId !== requestId) return
        const message = error instanceof Error ? error.message : String(error)
        setState("issueDetailErrorByKey", issueKey, message)
        toast.show(message)
      } finally {
        if (state.issueDetailRequestId === requestId) setState("issueDetailLoadingByKey", issueKey, false)
      }
    },
    async loadIssuePage(sourceId) {
      const currentPage = state.issuePageStateBySource[sourceId] ?? defaultIssuePageState(sourceId)
      if (currentPage.loading) return
      if (currentPage.isLast) {
        toast.show("No more Jira issues to load for this section")
        return
      }
      const requestId = (state.issuePageRequestIdBySource[sourceId] ?? 0) + 1
      setState("issuePageRequestIdBySource", sourceId, requestId)
      setState("issuePageStateBySource", sourceId, { ...currentPage, loading: true, error: undefined })
      try {
        const loaded = await props.source.loadIssuePage(sourceId, {
          project: state.project,
          board: state.board,
          statuses: state.statuses,
          pageState: currentPage,
        })
        if (state.issuePageRequestIdBySource[sourceId] !== requestId) return
        const nextIssues = { ...state.issues }
        for (const issue of loaded.issues) nextIssues[issue.key] = mergeLoadedPageIssue(nextIssues[issue.key], issue)
        setState("issues", reconcile(nextIssues))
        setState("stats", workspaceStats(state.statuses, Object.values(nextIssues)))
        setState("issuePageStateBySource", sourceId, reconcile({ ...loaded.pageState, loading: false, error: undefined }))
        if (!state.selectedIssueKey && loaded.issues[0]) setState("selectedIssueKey", loaded.issues[0].key)
      } catch (error) {
        if (state.issuePageRequestIdBySource[sourceId] !== requestId) return
        const message = error instanceof Error ? error.message : String(error)
        setState("issuePageStateBySource", sourceId, { ...currentPage, loading: false, error: message })
        toast.show(message)
      }
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
      if (fieldId === "assignee" || fieldId === "reporter") {
        const picker = state.inspectorUserPicker
        if (!picker || !picker.options.length) return
        setState("inspectorUserPicker", "selectedIndex", (picker.selectedIndex + delta + picker.options.length) % picker.options.length)
        return
      }
      if (fieldId !== "statusId" && fieldId !== "type" && fieldId !== "parentKey") return
      const issue = issueByKey(state, state.selectedIssueKey)
      const choices = fieldId === "statusId"
        ? configuredStatuses(state).map((status) => status.id)
        : fieldId === "type"
          ? configuredIssueTypes(state).map((type) => type.id)
          : issue ? ["", ...parentIssueChoices(state, issue).map((choice) => choice.value)] : []
      if (!choices.length) return
      const currentIndex = Math.max(0, choices.findIndex((choice) => choice === state.inspectorEditValue))
      setState("inspectorEditValue", choices[(currentIndex + delta + choices.length) % choices.length]!)
    },
    startInspectorEdit() {
      const issue = issueByKey(state, state.selectedIssueKey)
      const field = selectedIssueField(state)
      if (!issue || !field || !field.editable || !isEditableField(field.id)) return
      setState("inspectorEditingFieldId", field.id)
      setState("inspectorEditValue", field.id === "statusId" ? issue.statusId : field.id === "type" ? issue.type : field.id === "parentKey" ? issue.parentKey ?? "" : issueFieldDisplayValue(state, issue, field))
      if (field.id === "assignee" || field.id === "reporter") {
        setState("inspectorUserPicker", { fieldId: field.id, issueKey: issue.key, query: "", allOptions: [], options: [], selectedIndex: 0, loading: true })
        scheduleInspectorUserPicker(field.id, issue.key, "")
      }
    },
    updateInspectorEditValue(value) {
      setState("inspectorEditValue", value)
      const picker = state.inspectorUserPicker
      if (picker) {
        setState("inspectorUserPicker", "query", value)
        setState("inspectorUserPicker", "loading", true)
        scheduleInspectorUserPicker(picker.fieldId, picker.issueKey, value, 250)
      }
    },
    commitInspectorEdit() {
      const issueKey = state.selectedIssueKey
      const fieldId = state.inspectorEditingFieldId
      if (!fieldId) return
      if (fieldId === "assignee" || fieldId === "reporter") {
        const picker = state.inspectorUserPicker
        const user = picker?.options[picker.selectedIndex]
        if (!picker || !user) {
          toast.show("Select a Jira user from the assignable-user list")
          return
        }
        setState("issueDrafts", { ...state.issueDrafts, [issueKey]: { ...(state.issueDrafts[issueKey] ?? {}), [fieldId]: user.displayName } })
        setState("userDraftAccountIds", { ...state.userDraftAccountIds, [issueKey]: { ...(state.userDraftAccountIds[issueKey] ?? {}), [fieldId]: user.accountId } })
        setState("inspectorUserPicker", undefined)
        setState("inspectorEditingFieldId", undefined)
        setState("inspectorEditValue", "")
        return
      }
      setState("issueDrafts", { ...state.issueDrafts, [issueKey]: { ...(state.issueDrafts[issueKey] ?? {}), [fieldId]: state.inspectorEditValue } })
      setState("inspectorEditingFieldId", undefined)
      setState("inspectorEditValue", "")
      setState("inspectorUserPicker", undefined)
    },
    cancelInspectorEdit() {
      if (userPickerTimer) clearTimeout(userPickerTimer)
      userPickerRequestId += 1
      setState("inspectorEditingFieldId", undefined)
      setState("inspectorEditValue", "")
      setState("inspectorUserPicker", undefined)
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
      if (field.id === "assignee" || field.id === "reporter") {
        const userDrafts = { ...state.userDraftAccountIds }
        const users = { ...(userDrafts[issueKey] ?? {}) }
        delete users[field.id]
        if (Object.keys(users).length) userDrafts[issueKey] = users
        else delete userDrafts[issueKey]
        setState("userDraftAccountIds", reconcile(userDrafts))
      }
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
      setState("remoteDeleteConfirmationArmed", false)
      setState("stagedDiscardOpen", false)
      setState("stagedDiscardSelectedIndex", 0)
      setState("stagedDiscardSelections", [])
    },
    closeRemoteIssueApply() {
      setState("remoteApplyOpen", false)
      setState("remoteDeleteConfirmationArmed", false)
    },
    async confirmRemoteIssueApply() {
      if (state.remoteApplyApplying) return
      const operations = planJiraWrites(state).filter((item) => item.status === "planned" && item.operation && item.issueKey)
      if (!operations.length) {
        setState("remoteApplyOpen", false)
        toast.show("No staged Jira operations are ready to apply")
        return
      }
      if (operations.some((item) => item.operation === "delete") && !state.remoteDeleteConfirmationArmed) {
        setState("remoteDeleteConfirmationArmed", true)
        toast.show("Remote delete is armed. Press W again to permanently delete the staged issue.")
        return
      }
      setState("remoteApplyOpen", false)
      setState("remoteDeleteConfirmationArmed", false)
      setState("remoteApplyApplying", true)

      let applied = 0
      const failures: string[] = []
      const refreshedIssueKeys = new Set<string>()
      const createdIssueKeys = new Set<string>()
      for (const item of operations) {
        const issueKey = item.issueKey
        if (!issueKey) continue
        try {
          if (item.operation === "comment") {
            const draft = state.commentDrafts.find((candidate) => candidate.id === item.commentDraftId)
            if (!draft) continue
            await props.source.postIssueComment(issueKey, draft.body)
            setState("commentDrafts", (drafts) => drafts.filter((candidate) => candidate.id !== draft.id))
          }
          if (item.operation === "field-update") {
            const fieldId = item.fieldId
            const fieldValue = item.fieldValue
            if (!fieldId || fieldValue === undefined) continue
            await props.source.updateIssue(issueKey, jiraIssueFields(fieldId, fieldValue, item.fieldAccountId))
            const draft = { ...(state.issueDrafts[issueKey] ?? {}) }
            delete draft[fieldId]
            const drafts = { ...state.issueDrafts }
            if (Object.keys(draft).length) drafts[issueKey] = draft
            else delete drafts[issueKey]
            setState("issueDrafts", reconcile(drafts))
            if (fieldId === "assignee" || fieldId === "reporter") {
              const userDrafts = { ...state.userDraftAccountIds }
              const users = { ...(userDrafts[issueKey] ?? {}) }
              delete users[fieldId]
              if (Object.keys(users).length) userDrafts[issueKey] = users
              else delete userDrafts[issueKey]
              setState("userDraftAccountIds", reconcile(userDrafts))
            }
          }
          if (item.operation === "transition") {
            if (!item.transitionStatusId) continue
            await props.source.transitionIssue(issueKey, item.transitionStatusId)
            const draft = { ...(state.issueDrafts[issueKey] ?? {}) }
            delete draft.statusId
            const drafts = { ...state.issueDrafts }
            if (Object.keys(draft).length) drafts[issueKey] = draft
            else delete drafts[issueKey]
            setState("issueDrafts", reconcile(drafts))
          }
          if (item.operation === "sprint-move") {
            await props.source.moveIssueToSprint(issueKey, item.sprintId)
            const draft = { ...(state.issueDrafts[issueKey] ?? {}) }
            delete draft.sprintId
            const drafts = { ...state.issueDrafts }
            if (Object.keys(draft).length) drafts[issueKey] = draft
            else delete drafts[issueKey]
            setState("issueDrafts", reconcile(drafts))
          }
          if (item.operation === "discovered-field") {
            if (!item.discoveredField || item.fieldValue === undefined) continue
            await props.source.updateDiscoveredField(issueKey, item.discoveredField, item.fieldValue)
            const draft = { ...(state.issueDrafts[issueKey] ?? {}) }
            delete draft[item.discoveredField]
            const drafts = { ...state.issueDrafts }
            if (Object.keys(draft).length) drafts[issueKey] = draft
            else delete drafts[issueKey]
            setState("issueDrafts", reconcile(drafts))
          }
          if (item.operation === "issue-type") {
            if (!item.issueType) continue
            await props.source.updateIssueType(issueKey, item.issueType)
            const draft = { ...(state.issueDrafts[issueKey] ?? {}) }
            delete draft.type
            const drafts = { ...state.issueDrafts }
            if (Object.keys(draft).length) drafts[issueKey] = draft
            else delete drafts[issueKey]
            setState("issueDrafts", reconcile(drafts))
          }
          if (item.operation === "delete") {
            await props.source.deleteIssue(issueKey)
            const issues = { ...state.issues }
            delete issues[issueKey]
            setState("issues", reconcile(issues))
            setState("stats", workspaceStats(state.statuses, Object.values(issues)))
            setState("issueDeletes", (deletes) => deletes.filter((key) => key !== issueKey))
            if (state.selectedIssueKey === issueKey) setState("selectedIssueKey", Object.keys(issues)[0] ?? "")
          }
          if (item.operation === "create") {
            const draft = state.issues[issueKey]
            if (!draft) continue
            const createdKey = await props.source.createIssue(draft, state.project.key)
            const issues = { ...state.issues }
            delete issues[issueKey]
            setState("issues", reconcile(issues))
            if (state.selectedIssueKey === issueKey) setState("selectedIssueKey", createdKey)
            createdIssueKeys.add(createdKey)
          }
          if (item.operation === "link") {
            if (!item.linkTargetKeys?.length) continue
            await props.source.createIssueLinks(issueKey, item.linkTargetKeys)
            const draft = { ...(state.issueDrafts[issueKey] ?? {}) }
            delete draft.links
            const drafts = { ...state.issueDrafts }
            if (Object.keys(draft).length) drafts[issueKey] = draft
            else delete drafts[issueKey]
            setState("issueDrafts", reconcile(drafts))
          }
          if (item.operation === "rank") {
            if (!item.rankTargetIssueKey || !item.rankPosition) continue
            await props.source.rankIssue(issueKey, item.rankTargetIssueKey, item.rankPosition)
            const drafts = { ...state.rankDrafts }
            delete drafts[issueKey]
            setState("rankDrafts", reconcile(drafts))
          }
          if (item.operation !== "delete" && item.operation !== "create") refreshedIssueKeys.add(issueKey)
          applied += 1
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error))
        }
      }
      await Promise.all([...refreshedIssueKeys, ...createdIssueKeys].map((issueKey) => context.loadIssueDetail(issueKey)))
      if (failures.length) {
        setState("remoteApplyApplying", false)
        toast.show(`${applied} Jira operation${applied === 1 ? "" : "s"} applied; ${failures.length} failed: ${failures.join("; ")}`)
        return
      }
      setState("remoteApplyApplying", false)
      toast.show(`${applied} Jira operation${applied === 1 ? "" : "s"} applied`)
    },
    refreshWorkspace() {
      if (state.workspaceLoading || !state.jiraProjectReady) return
      void loadWorkspace({ project: state.project, board: state.board }, true)
    },
    retryWorkspaceLoad() {
      if (state.workspaceLoading || !state.workspaceLoadError) return
      void loadWorkspace({ project: state.project, board: state.board }, true)
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
    startComment() {
      const issue = issueByKey(state, state.selectedIssueKey)
      if (!issue || state.route === "workspace" || state.route === "config") return
      setState("commentEditValue", "")
      setState("commentEditing", true)
    },
    updateCommentValue(value) {
      setState("commentEditValue", value)
    },
    commitComment() {
      const issue = issueByKey(state, state.selectedIssueKey)
      const body = state.commentEditValue.trim()
      if (!issue || !body) return
      setState("commentDrafts", (drafts) => [...drafts, { id: `comment-${state.commentDraftCounter}`, issueKey: issue.key, body }])
      setState("commentDraftCounter", state.commentDraftCounter + 1)
      setState("commentEditing", false)
      setState("commentEditValue", "")
      toast.show(`Comment on ${issue.key} staged`)
    },
    cancelComment() {
      setState("commentEditing", false)
      setState("commentEditValue", "")
    },
    stageIssueRank(issueKey, targetIssueKey, position) {
      if (!state.issues[issueKey] || !state.issues[targetIssueKey] || issueKey === targetIssueKey) return
      setState("rankDrafts", issueKey, { issueKey, targetIssueKey, position })
      toast.show(`${issueKey} rank staged ${position} ${targetIssueKey}`)
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
      const userDraftAccountIds = { ...state.userDraftAccountIds }
      let issueDeletes = [...state.issueDeletes]
      let configDrafts = [...state.configDrafts]
      let commentDrafts = [...state.commentDrafts]
      const rankDrafts = { ...state.rankDrafts }
      const issues = { ...state.issues }
      for (const change of changes) {
        if (!selectedIds.has(change.id)) continue
        discardedCount += 1
        if (change.kind === "create") {
          delete issues[change.issueKey]
          delete issueDrafts[change.issueKey]
          delete userDraftAccountIds[change.issueKey]
          issueDeletes = issueDeletes.filter((issueKey) => issueKey !== change.issueKey)
          commentDrafts = commentDrafts.filter((draft) => draft.issueKey !== change.issueKey)
          delete rankDrafts[change.issueKey]
          continue
        }
        if (change.kind === "config") {
          configDrafts = configDrafts.filter((draft) => draft.id !== change.draftId)
          continue
        }
        if (change.kind === "comment") {
          commentDrafts = commentDrafts.filter((draft) => draft.id !== change.commentId)
          continue
        }
        if (change.kind === "rank") {
          delete rankDrafts[change.issueKey]
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
        if (change.fieldId === "assignee" || change.fieldId === "reporter") {
          const users = { ...(userDraftAccountIds[change.issueKey] ?? {}) }
          delete users[change.fieldId]
          if (Object.keys(users).length) userDraftAccountIds[change.issueKey] = users
          else delete userDraftAccountIds[change.issueKey]
        }
      }
      setState("issues", reconcile(issues))
      if (!issues[state.selectedIssueKey]) setState("selectedIssueKey", Object.keys(issues)[0] ?? "")
      setState("stats", workspaceStats(state.statuses, Object.values(issues)))
      setState("issueDrafts", reconcile(issueDrafts))
      setState("userDraftAccountIds", reconcile(userDraftAccountIds))
      setState("issueDeletes", issueDeletes)
      setState("configDrafts", reconcile(configDrafts))
      setState("commentDrafts", reconcile(commentDrafts))
      setState("rankDrafts", reconcile(rankDrafts))
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
      setState("commentEditing", false)
      setState("commentEditValue", "")
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
    setSelectedBoardLocation(mode, location) {
      setState("selectedBoardLocations", mode, location)
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
    setSelectedBacklogGroup(groupId) {
      setState("selectedBacklogGroupId", groupId)
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

export function detailBodyInitialValue(state: AppState, issue: IssueSummary) {
  return state.issueDrafts[issue.key]?.description ?? issue.description
}

function mergeLoadedPageIssue(existing: IssueSummary | undefined, issue: IssueSummary): IssueSummary {
  return {
    ...existing,
    ...issue,
    description: issue.description || existing?.description || "",
    comments: existing?.comments.length ? existing.comments : issue.comments,
    links: issue.links.length ? issue.links : existing?.links ?? [],
    isDraft: existing?.isDraft ?? issue.isDraft,
  }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

function remoteSearchWorkspaceItemIndex(state: AppState) {
  return Math.max(0, workspaceItems(state).findIndex((item) => item.id === "search:remote"))
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
  if (sectionId === "columns") return configuredColumns(state).find((column) => column.id === targetId)?.name ?? targetId
  if (sectionId === "issue-types") return configuredIssueTypes(state).find((type) => type.id === targetId)?.name ?? targetId
  return configuredStatuses(state).find((status) => status.id === targetId)?.name ?? targetId
}

function configTargetColor(state: AppState, sectionId: ConfigSectionId, targetId: string) {
  if (sectionId === "columns") return configuredColumns(state).find((column) => column.id === targetId)?.color ?? statusColorForCategory("todo")
  if (sectionId === "issue-types") return configuredIssueTypes(state).find((type) => type.id === targetId)?.color ?? defaultIssueTypeColor
  return configuredStatuses(state).find((status) => status.id === targetId)?.color ?? statusColorForCategory("todo")
}

function defaultConfigColor(sectionId: ConfigDraft["sectionId"]) {
  return sectionId === "issue-types" ? defaultIssueTypeColor : statusColorForCategory("todo")
}

function defaultStatusCategory(state: AppState, sectionId: ConfigDraft["sectionId"]): StatusCategory | undefined {
  if (sectionId === "issue-types") return
  const targetId = selectedConfigTargetId(state)
  if (sectionId === "columns") return configuredColumns(state).find((column) => column.id === targetId)?.category ?? "todo"
  return configuredStatuses(state).find((status) => status.id === targetId)?.category ?? "todo"
}

function authOnboardingField(step: AuthOnboardingStep): "baseUrl" | "email" | "apiToken" {
  return step
}

function workspaceOptionFromContext(project: ProjectOption, board: BoardOption): WorkspaceOption {
  return {
    id: `${project.key}:${board.id}`,
    projectKey: project.key,
    projectName: project.name,
    boardId: board.id,
    boardName: board.name,
    boardType: board.type,
  }
}

function recentWorkspacesWith(active: WorkspaceOption, workspaces: WorkspaceOption[]) {
  const seen = new Set<string>()
  const next: WorkspaceOption[] = []
  for (const workspace of [active, ...workspaces]) {
    const key = `${workspace.projectKey}:${workspace.boardId}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push(workspace)
  }
  return next
}

function isActiveWorkspace(state: AppState, project: ProjectOption, board: BoardOption) {
  return state.project.key === project.key && state.board.id === board.id
}

function hasRecentWorkspace(state: AppState, workspace: WorkspaceOption) {
  return state.recentWorkspaces.some((candidate) => candidate.projectKey === workspace.projectKey && candidate.boardId === workspace.boardId)
}

function activeRecentWorkspaceIndex(state: AppState) {
  const index = state.recentWorkspaces.findIndex((workspace) => workspace.projectKey === state.project.key && workspace.boardId === state.board.id)
  return Math.max(0, index)
}

function jiraIssueFields(fieldId: IssueEditableField, value: string, accountId?: string): Record<string, unknown> {
  switch (fieldId) {
    case "title":
      return { summary: value }
    case "priority":
      return { priority: { name: value } }
    case "parentKey":
      return { parent: value ? { key: value } : null }
    case "dueDate":
      return { duedate: value || null }
    case "labels":
      return { labels: splitJiraList(value) }
    case "components":
      return { components: splitJiraList(value).map((name) => ({ name })) }
    case "fixVersions":
      return { fixVersions: splitJiraList(value).map((name) => ({ name })) }
    case "affectsVersions":
      return { versions: splitJiraList(value).map((name) => ({ name })) }
    case "description":
      return { description: jiraDocument(value) }
    case "assignee":
    case "reporter":
      if (!accountId) throw new Error(`Missing Jira account ID for ${fieldId}`)
      return { [fieldId]: { accountId } }
    default:
      throw new Error(`Unsupported Jira field update: ${fieldId}`)
  }
}

function splitJiraList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function filterJiraUsers(users: JiraUserOption[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return normalizedQuery ? users.filter((user) => user.displayName.toLowerCase().includes(normalizedQuery)) : users
}

function jiraDocument(text: string) {
  const result = markdownToAdf(text)
  if (!result.document) throw new Error(result.writeBlockedReason ?? "This Jira text cannot be converted safely.")
  return result.document
}
