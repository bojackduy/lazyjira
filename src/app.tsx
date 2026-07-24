import { useTerminalDimensions } from "@opentui/solid"
import { createEffect } from "solid-js"
import { useBindings } from "./context/keymap"
import { useAppState } from "./context/app-state"
import { useExit } from "./context/exit"
import { AppShell } from "./ui/shell"
import { configuredStatuses } from "./state/config-drafts"
import { issueByKey } from "./state/issue-drafts"
import { backlogIssuePageSourceId, boardIssuePageSourceId, issuePageCanLoadMore, sprintIssuePageSourceId } from "./state/issue-pages"
import { sidebarRoutes } from "./state/routes"
import type { BoardLocation, BoardMode, IssueSummary } from "./state/app-state"
import {
  boardCellItems,
  boardCellIssueKeys,
  boardIssueKeyAtLocation,
  firstBoardLocation,
  selectedBoardItemLocation,
  selectedBoardLocation,
} from "./state/board-navigation"
import {
  boardGroupsForMode,
  boardGroupByForMode,
  boardIssuesForMode,
  boardStatusOffsetForMode,
  boardStatusWindowSize,
  groupBacklogIssues,
  nextBacklogGroupBy,
  nextBoardGroupBy,
  visibleStatusesForBoard,
} from "./state/selectors"

export function App() {
  const appState = useAppState()
  const { state } = appState
  const dimensions = useTerminalDimensions()
  const exit = useExit()

  createEffect(() => {
    if (isBoardRoute(state.route)) ensureSelectedIssue(visibleBoardIssueKeys(state.route))
    if (state.route === "backlog") ensureSelectedIssue(groupBacklogIssues(state, state.backlogGroupBy).flatMap((group) => group.issueKeys))
  })

  useBindings(() => ({
    commands: [
      {
        name: "app.quit",
        run() {
          if (state.remoteApplyOpen) {
            appState.closeRemoteIssueApply()
            return
          }
          if (state.stagedDiscardOpen) {
            appState.closeStagedDiscard()
            return
          }
          if (state.projectPicker.open) {
            appState.closeProjectPicker()
            return
          }
          if (state.searchOpen) {
            appState.closeSearch()
            return
          }
          if (isPlainTextEditing()) return false
          if (state.pendingDeleteIssueKey) {
            appState.cancelIssueDelete()
            return
          }
          if (state.route === "workspace" && state.workspaceFocusedArea === "results") {
            appState.closeWorkspaceResults()
            return
          }
          if (state.configEditing) {
            appState.cancelConfigEdit()
            return
          }
          if (state.route === "issue-detail") {
            appState.closeIssueDetail()
            return
          }
          exit.exit()
        },
      },
      { name: "app.force-quit", run: () => exit.exit() },
      {
        name: "edit.cancel",
        run() {
          if (state.remoteApplyOpen) appState.closeRemoteIssueApply()
          else if (state.stagedDiscardOpen) appState.closeStagedDiscard()
          else if (state.projectPicker.open) appState.closeProjectPicker()
          else if (state.searchOpen) appState.closeSearch()
          else if (state.pendingDeleteIssueKey) appState.cancelIssueDelete()
          else if (state.route === "workspace" && state.workspaceFocusedArea === "results") appState.closeWorkspaceResults()
          else if (state.configEditing) appState.cancelConfigEdit()
          else if (state.detailBodyEditing) appState.cancelDetailBodyEdit()
          else appState.cancelInspectorEdit()
        },
      },
      { name: "edit.stage", run: () => stageCurrentEdit() },
      { name: "detail.back", run: () => (isPlainTextEditing() || isPopupOpen() ? false : appState.closeIssueDetail()) },
      { name: "route.workspace", run: () => (canRunGlobalShortcut() ? appState.setRoute("workspace") : false) },
      { name: "route.active-sprint", run: () => (canRunGlobalShortcut() ? appState.setRoute("active-sprint") : false) },
      { name: "route.backlog", run: () => (canRunGlobalShortcut() ? appState.setRoute("backlog") : false) },
      { name: "route.kanban", run: () => (canRunGlobalShortcut() ? appState.setRoute("kanban") : false) },
      { name: "route.config", run: () => (canRunGlobalShortcut() ? appState.setRoute("config") : false) },
      { name: "project.switch", run: () => (canRunGlobalShortcut() ? appState.openProjectPicker() : false) },
      { name: "search.open", run: () => (canRunGlobalShortcut() && state.route !== "config" ? appState.openSearch() : false) },
      { name: "search.remote-open", run: () => (canRunGlobalShortcut() && state.route !== "config" ? appState.openRemoteSearch() : false) },
      { name: "issue.refresh-detail", run: () => refreshSelectedIssueDetail() },
      { name: "issue.load-more", run: () => loadMoreIssues() },
      { name: "focus.next", run: () => (isPlainTextEditing() || isPopupOpen() ? false : appState.focusNextPane(1)) },
      { name: "focus.previous", run: () => (isPlainTextEditing() || isPopupOpen() ? false : appState.focusNextPane(-1)) },
      { name: "pane.down", run: () => moveVertical(1) },
      { name: "pane.up", run: () => moveVertical(-1) },
      { name: "pane.right", run: () => moveHorizontal(1) },
      { name: "pane.left", run: () => moveHorizontal(-1) },
      { name: "pane.enter", run: () => openFocusedItem() },
      { name: "sidebar.toggle-filter", run: () => toggleSpaceAction() },
      { name: "staged-discard.down", run: () => (state.stagedDiscardOpen ? appState.moveStagedDiscardSelection(1) : moveVertical(1)) },
      { name: "staged-discard.up", run: () => (state.stagedDiscardOpen ? appState.moveStagedDiscardSelection(-1) : moveVertical(-1)) },
      { name: "staged-discard.confirm", run: () => (state.stagedDiscardOpen ? appState.confirmStagedDiscard() : openFocusedItem()) },
      { name: "staged-discard.toggle", run: () => (state.stagedDiscardOpen ? appState.toggleStagedDiscardSelection() : toggleSpaceAction()) },
      { name: "group.cycle", run: () => cycleGroup() },
      { name: "issue.edit", run: () => editSelectedIssue() },
      { name: "issue.new", run: () => createIssueFromContext() },
      { name: "config.add", run: () => addConfigRow() },
      { name: "config.color", run: () => colorConfigRow() },
      { name: "issue.apply", run: () => writeStagedRender() },
      { name: "issue.remote-apply", run: () => remoteApplyAction() },
      { name: "issue.delete", run: () => deleteOrRemoveSelection() },
      { name: "issue.confirm-delete", run: () => (canRunGlobalShortcut() ? appState.confirmIssueDelete() : false) },
      { name: "issue.cancel-delete", run: () => (canRunGlobalShortcut() ? appState.cancelIssueDelete() : false) },
      { name: "staged-discard.open", run: () => (isPlainTextEditing() || isPopupOpen() || isAnyEditing() ? false : appState.openStagedDiscard()) },
    ],
    bindings: state.searchOpen ? searchBindings() : [
      { key: "q", cmd: "app.quit", preventDefault: false },
      { key: { name: "c", ctrl: true }, cmd: "app.force-quit" },
      { key: "escape", cmd: "edit.cancel" },
      { key: { name: "return", ctrl: true }, cmd: "edit.stage" },
      { key: "backspace", cmd: "detail.back", preventDefault: false },
      { key: "tab", cmd: "focus.next", preventDefault: false },
      { key: { name: "tab", shift: true }, cmd: "focus.previous", preventDefault: false },
      { key: "1", cmd: "route.workspace", preventDefault: false },
      { key: "2", cmd: "route.active-sprint", preventDefault: false },
      { key: "3", cmd: "route.backlog", preventDefault: false },
      { key: "4", cmd: "route.kanban", preventDefault: false },
      { key: "5", cmd: "route.config", preventDefault: false },
      { key: { name: "p", shift: true }, cmd: "project.switch", preventDefault: false },
      { key: "/", cmd: "search.open", preventDefault: false },
      { key: { name: "s", shift: true }, cmd: "search.remote-open", preventDefault: false },
      { key: "r", cmd: "issue.refresh-detail", preventDefault: false },
      { key: { name: "l", shift: true }, cmd: "issue.load-more", preventDefault: false },
      { key: "j", cmd: "staged-discard.down", preventDefault: false },
      { key: "down", cmd: "staged-discard.down", preventDefault: false },
      { key: "k", cmd: "staged-discard.up", preventDefault: false },
      { key: "up", cmd: "staged-discard.up", preventDefault: false },
      { key: "l", cmd: "pane.right", preventDefault: false },
      { key: "right", cmd: "pane.right", preventDefault: false },
      { key: "h", cmd: "pane.left", preventDefault: false },
      { key: "left", cmd: "pane.left", preventDefault: false },
      { key: "return", cmd: "staged-discard.confirm", preventDefault: false },
      { key: "space", cmd: "staged-discard.toggle", preventDefault: false },
      { key: "g", cmd: "group.cycle", preventDefault: false },
      { key: "e", cmd: "issue.edit", preventDefault: false },
      { key: "n", cmd: "issue.new", preventDefault: false },
      { key: "a", cmd: "config.add", preventDefault: false },
      { key: "c", cmd: "config.color", preventDefault: false },
      { key: "w", cmd: "issue.apply", preventDefault: false },
      { key: { name: "w", shift: true }, cmd: "issue.remote-apply", preventDefault: false },
      { key: "x", cmd: "issue.delete", preventDefault: false },
      { key: "y", cmd: "issue.confirm-delete", preventDefault: false },
      { key: { name: "x", shift: true }, cmd: "staged-discard.open", preventDefault: false },
    ],
  }))

  function searchBindings() {
    return [{ key: "escape", cmd: "edit.cancel", preventDefault: false }]
  }

  function moveVertical(delta: number) {
    if (state.remoteApplyOpen) return false
    if (state.stagedDiscardOpen) {
      appState.moveStagedDiscardSelection(delta)
      return
    }
    if (isPlainTextEditing()) return false
    if (state.focusedPane === "sidebar") {
      appState.moveSidebarSelection(delta)
      return
    }
    if (state.focusedPane === "inspector") {
      if (state.inspectorEditingFieldId === "statusId" || state.inspectorEditingFieldId === "type") {
        appState.moveInspectorChoice(delta)
        return
      }
      appState.moveInspectorSelection(delta)
      return
    }
    if (state.focusedPane !== "main") return
    if (state.route === "workspace") {
      appState.moveWorkspaceSelection(delta)
      return
    }
    if (state.route === "config") {
      appState.moveConfigSelection(delta)
      return
    }
    if (isBoardRoute(state.route)) moveBoardVertical(state.route, delta)
    if (state.route === "backlog") moveBacklogSelection(delta)
  }

  function moveHorizontal(delta: number) {
    if (isPlainTextEditing() || isPopupOpen()) return false
    if (state.focusedPane === "sidebar" && delta > 0) {
      appState.openSidebarSelection()
      if (state.sidebarSelectedIndex < sidebarRoutes.length) appState.setFocusedPane("main")
      return
    }
    if (state.focusedPane !== "main") return
    if (state.route === "workspace") {
      if (delta > 0) appState.focusWorkspaceResults()
      else appState.closeWorkspaceResults()
      return
    }
    if (state.route === "config") {
      appState.focusConfigArea(delta > 0 ? "rows" : "sections")
      return
    }
    if (isBoardRoute(state.route)) moveBoardHorizontal(state.route, delta)
    if (state.route === "backlog") moveBacklogGroup(delta)
  }

  function openFocusedItem() {
    if (state.remoteApplyOpen) return false
    if (state.stagedDiscardOpen) {
      appState.confirmStagedDiscard()
      return
    }
    if (isPlainTextEditing()) return false
    if (state.focusedPane === "sidebar") {
      appState.openSidebarSelection()
      if (state.sidebarSelectedIndex < sidebarRoutes.length) appState.setFocusedPane("main")
      return
    }
    if (state.focusedPane === "inspector") {
      if (state.inspectorEditingFieldId) {
        appState.commitInspectorEdit()
        return
      }
      appState.startInspectorEdit()
      return
    }
    if (state.focusedPane !== "main") return
    if (state.route === "workspace") {
      appState.openWorkspaceSelection()
      return
    }
    if (state.route === "config") {
      if (state.configEditing) appState.commitConfigEdit()
      else if (state.configFocusedArea === "sections") appState.focusConfigArea("rows")
      else appState.startConfigRename()
      return
    }
    if (isBoardRoute(state.route)) {
      const location = selectedBoardItemLocation(state, state.route)
      const issueKey = location ? boardIssueKeyAtLocation(state, state.route, location) : undefined
      if (issueKey) appState.openIssueDetail(issueKey)
      else createIssueFromContext()
      return
    }
    if (state.route === "backlog") appState.openIssueDetail(state.selectedIssueKey)
  }

  function cycleGroup() {
    if (!canRunGlobalShortcut()) return false
    if (state.focusedPane !== "main") return
    if (state.route === "active-sprint") {
      appState.setActiveSprintGroupBy(nextBoardGroupBy(state.activeSprintGroupBy))
      appState.setActiveSprintStatusOffset(0)
    }
    if (state.route === "kanban") {
      appState.setKanbanGroupBy(nextBoardGroupBy(state.kanbanGroupBy))
      appState.setKanbanStatusOffset(0)
    }
    if (state.route === "backlog") appState.setBacklogGroupBy(nextBacklogGroupBy(state.backlogGroupBy))
  }

  function editSelectedIssue() {
    if (isPlainTextEditing() || isPopupOpen()) return false
    if (state.route === "workspace") return false
    if (state.route === "config") {
      appState.startConfigRename()
      return
    }
    if (state.route === "issue-detail" && state.focusedPane === "main") {
      appState.startDetailBodyEdit()
      return
    }
    if (state.focusedPane !== "inspector") {
      appState.setFocusedPane("inspector")
      appState.startInspectorEdit()
      return
    }
    appState.startInspectorEdit()
  }

  function createIssueFromContext() {
    if (isPlainTextEditing() || isPopupOpen()) return false
    if (state.pendingDeleteIssueKey) {
      appState.cancelIssueDelete()
      return
    }
    if (state.route === "workspace") return false
    if (state.route === "config") return false
    if (state.route === "issue-detail") return
    const boardMode = isBoardRoute(state.route) ? state.route : undefined
    const location = boardMode ? selectedBoardItemLocation(state, boardMode) : undefined
    const statuses = configuredStatuses(state)
    const selectedIssueKey = boardMode && location ? boardIssueKeyAtLocation(state, boardMode, location) : undefined
    const current = selectedIssueKey ? state.issues[selectedIssueKey] : state.issues[state.selectedIssueKey]
    const groupIssue = boardMode && location ? firstIssueInBoardGroup(location, boardMode) : undefined
    const defaultSource = boardMode ? (current ?? groupIssue) : current
    const statusId = location ? statuses[location.statusIndex]?.id : current?.statusId
    const key = `DRAFT-${state.draftIssueCounter}`
    const groupDefaults = defaultSource && boardMode ? defaultsFromBoardGroup(defaultSource, boardGroupByForMode(state, boardMode)) : {}
    const issue: IssueSummary = {
      key,
      title: "New issue",
      type: groupDefaults.type ?? "Task",
      priority: groupDefaults.priority ?? defaultSource?.priority ?? "Medium",
      statusId: statusId ?? statuses[0]?.id ?? "todo",
      assignee: groupDefaults.assignee ?? defaultSource?.assignee ?? state.currentUser,
      reporter: state.currentUser,
      epic: groupDefaults.epic ?? defaultSource?.epic,
      feature: groupDefaults.feature ?? defaultSource?.feature,
      space: groupDefaults.space ?? defaultSource?.space,
      sprintId: state.route === "active-sprint" ? state.activeSprintId : defaultSource?.sprintId,
      storyPoints: 0,
      estimate: 0,
      dueDate: "",
      createdAt: "now",
      updatedAt: "now",
      resolution: undefined,
      fixVersions: [],
      affectsVersions: [],
      rank: key,
      isDraft: true,
      labels: defaultSource?.labels ?? [],
      components: defaultSource?.components ?? [],
      blocked: false,
      staleDays: 0,
      description: "",
      comments: [],
      links: [],
    }
    const nextItemIndex = boardMode && location ? boardCellIssueKeys(state, boardMode, location.groupIndex, location.statusIndex).length : undefined
    appState.createDraftIssue(issue)
    if (boardMode && location && nextItemIndex !== undefined) appState.setSelectedBoardLocation(boardMode, { ...location, itemIndex: nextItemIndex })

    function firstIssueInBoardGroup(location: BoardLocation, mode: BoardMode) {
      const issueKey = boardGroupsForMode(state, mode)[location.groupIndex]?.issueKeys[0]
      return issueKey ? state.issues[issueKey] : undefined
    }
  }

  function toggleSpaceAction() {
    if (state.remoteApplyOpen) return false
    if (state.stagedDiscardOpen) {
      appState.toggleStagedDiscardSelection()
      return
    }
    if (isPlainTextEditing()) return false
    if (state.focusedPane === "sidebar") appState.toggleSidebarFilterSelection()
  }

  function stageCurrentEdit() {
    if (isPopupOpen()) return false
    if (state.configEditing) {
      appState.commitConfigEdit()
      return
    }
    if (state.detailBodyEditing) {
      appState.commitDetailBodyEdit()
      return
    }
    if (state.inspectorEditingFieldId) {
      appState.commitInspectorEdit()
      return
    }
    return false
  }

  function writeStagedRender() {
    if (isPopupOpen() || state.detailBodyEditing || state.configEditing) return false
    if (state.inspectorEditingFieldId && state.inspectorEditingFieldId !== "statusId" && state.inspectorEditingFieldId !== "type") return false
    if (state.inspectorEditingFieldId) appState.commitInspectorEdit()
    appState.applyIssueChanges()
  }

  function canRunGlobalShortcut() {
    return !isPlainTextEditing() && !isPopupOpen()
  }

  function remoteApplyAction() {
    if (isPlainTextEditing() || state.stagedDiscardOpen) return false
    if (state.remoteApplyOpen) {
      appState.confirmRemoteIssueApply()
      return
    }
    appState.openRemoteIssueApply()
  }

  function refreshSelectedIssueDetail() {
    if (!canRunGlobalShortcut() || state.route !== "issue-detail") return false
    void appState.loadIssueDetail()
  }

  function loadMoreIssues() {
    if (!canRunGlobalShortcut() || state.focusedPane !== "main") return false
    if (state.searchMode === "remote" && state.remoteSearchQuery && issuePageCanLoadMore(state.remoteSearchPageState)) {
      void appState.loadMoreRemoteSearch()
      return
    }
    const sourceId = loadMoreSourceId()
    if (!sourceId) return false
    void appState.loadIssuePage(sourceId)
  }

  function loadMoreSourceId() {
    if (state.route === "kanban") return boardIssuePageSourceId
    if (state.route !== "backlog") return undefined
    const selectedIssue = issueByKey(state, state.selectedIssueKey)
    const selectedSourceId = selectedIssue?.sprintId ? sprintIssuePageSourceId(selectedIssue.sprintId) : backlogIssuePageSourceId
    if (issuePageCanLoadMore(state.issuePageStateBySource[selectedSourceId])) return selectedSourceId
    return [
      ...state.sprints.map((sprint) => sprintIssuePageSourceId(sprint.id)),
      backlogIssuePageSourceId,
    ].find((sourceId) => issuePageCanLoadMore(state.issuePageStateBySource[sourceId]))
  }

  function isPopupOpen() {
    return state.remoteApplyOpen || state.stagedDiscardOpen || state.authOnboarding.open || state.projectPicker.open
  }

  function isPlainTextEditing() {
    return state.authOnboarding.open || state.projectPicker.open || state.searchOpen || state.detailBodyEditing || !!state.configEditing || (!!state.inspectorEditingFieldId && state.inspectorEditingFieldId !== "statusId" && state.inspectorEditingFieldId !== "type")
  }

  function isAnyEditing() {
    return state.authOnboarding.open || state.projectPicker.open || state.detailBodyEditing || !!state.inspectorEditingFieldId || !!state.configEditing
  }

  function addConfigRow() {
    if (!canRunGlobalShortcut() || state.route !== "config") return false
    appState.startConfigAdd()
  }

  function colorConfigRow() {
    if (!canRunGlobalShortcut() || state.route !== "config") return false
    appState.startConfigColor()
  }

  function deleteOrRemoveSelection() {
    if (!canRunGlobalShortcut()) return false
    if (state.route === "config") {
      appState.stageConfigRemove()
      return
    }
    appState.requestIssueDelete()
  }

  function defaultsFromBoardGroup(issue: IssueSummary, groupBy: ReturnType<typeof boardGroupByForMode>): Partial<IssueSummary> {
    switch (groupBy) {
      case "assignee":
        return { assignee: issue.assignee }
      case "epic":
        return { epic: issue.epic }
      case "feature":
        return { feature: issue.feature }
      case "space":
        return { space: issue.space }
      case "issueType":
        return { type: issue.type }
      case "priority":
        return { priority: issue.priority }
      case "none":
        return {}
    }
  }

  function moveBoardVertical(mode: BoardMode, delta: number) {
    const location = selectedBoardItemLocation(state, mode) ?? firstBoardLocation(state, mode)
    if (!location) return
    const cell = boardCellItems(state, mode, location.groupIndex, location.statusIndex)
    const nextItemIndex = location.itemIndex + delta
    if (cell[nextItemIndex]) {
      selectBoardItemLocation(mode, { ...location, itemIndex: nextItemIndex })
      return
    }

    const groups = boardGroupsForMode(state, mode)
    for (let groupIndex = location.groupIndex + delta; groupIndex >= 0 && groupIndex < groups.length; groupIndex += delta) {
      const items = boardCellItems(state, mode, groupIndex, location.statusIndex)
      if (items.length) {
        selectBoardItemLocation(mode, { groupIndex, statusIndex: location.statusIndex, itemIndex: delta > 0 ? 0 : items.length - 1 })
        return
      }
    }
  }

  function moveBoardHorizontal(mode: BoardMode, delta: number) {
    const location = selectedBoardItemLocation(state, mode) ?? firstBoardLocation(state, mode)
    if (!location) return
    const statuses = configuredStatuses(state)
    const groups = boardGroupsForMode(state, mode)
    const targetStatusIndex = Math.max(0, Math.min(statuses.length - 1, location.statusIndex + delta))
    const targetItems = boardCellItems(state, mode, location.groupIndex, targetStatusIndex)
    ensureStatusVisible(mode, targetStatusIndex)
    if (!groups[location.groupIndex]) return
    if (!targetItems.length) return
    selectBoardItemLocation(mode, { ...location, statusIndex: targetStatusIndex, itemIndex: Math.min(location.itemIndex, targetItems.length - 1) })
  }

  function moveBacklogSelection(delta: number) {
    const keys = groupBacklogIssues(state, state.backlogGroupBy).flatMap((group) => group.issueKeys)
    if (!keys.length) return
    const currentIndex = keys.indexOf(state.selectedIssueKey)
    const startIndex = currentIndex === -1 ? 0 : currentIndex
    appState.selectIssue(keys[(startIndex + delta + keys.length) % keys.length] ?? keys[0]!)
  }

  function moveBacklogGroup(delta: number) {
    const groups = groupBacklogIssues(state, state.backlogGroupBy)
    if (!groups.length) return
    const currentGroupIndex = Math.max(
      0,
      groups.findIndex((group) => group.issueKeys.includes(state.selectedIssueKey)),
    )
    const nextGroup = groups[(currentGroupIndex + delta + groups.length) % groups.length]
    const firstIssueKey = nextGroup?.issueKeys[0]
    if (firstIssueKey) appState.selectIssue(firstIssueKey)
  }

  function visibleBoardIssueKeys(mode: BoardMode) {
    const visibleStatusIds = new Set(visibleStatusesForBoard(state, mode, dimensions().width).map((status) => status.id))
    const keys: string[] = []
    for (const group of boardGroupsForMode(state, mode)) {
      keys.push(...group.issueKeys.filter((issueKey) => visibleStatusIds.has(issueByKey(state, issueKey)?.statusId ?? "")))
    }
    return keys.length ? keys : boardIssuesForMode(state, mode).map((issue) => issue.key)
  }

  function ensureStatusVisible(mode: BoardMode, statusIndex: number) {
    const statusCount = configuredStatuses(state).length
    const windowSize = boardStatusWindowSize(dimensions().width, statusCount)
    const maxOffset = Math.max(0, statusCount - windowSize)
    const currentOffset = boardStatusOffsetForMode(state, mode)
    let nextOffset = currentOffset
    if (statusIndex < currentOffset) nextOffset = statusIndex
    if (statusIndex >= currentOffset + windowSize) nextOffset = statusIndex - windowSize + 1
    nextOffset = Math.max(0, Math.min(nextOffset, maxOffset))
    if (mode === "active-sprint") appState.setActiveSprintStatusOffset(nextOffset)
    else appState.setKanbanStatusOffset(nextOffset)
  }

  function selectBoardIssue(mode: BoardMode, issueKey: string) {
    const location = selectedBoardLocation(state, mode, issueKey)
    appState.selectIssue(issueKey)
    if (location) appState.setSelectedBoardLocation(mode, location)
    if (location) ensureStatusVisible(mode, location.statusIndex)
  }

  function selectBoardItemLocation(mode: BoardMode, location: BoardLocation) {
    appState.setSelectedBoardLocation(mode, location)
    const issueKey = boardIssueKeyAtLocation(state, mode, location)
    if (issueKey) appState.selectIssue(issueKey)
    ensureStatusVisible(mode, location.statusIndex)
  }

  function isBoardRoute(route: string): route is "active-sprint" | "kanban" {
    return route === "active-sprint" || route === "kanban"
  }

  function ensureSelectedIssue(keys: string[]) {
    if (!keys.length || keys.includes(state.selectedIssueKey)) return
    appState.selectIssue(keys[0]!)
  }

  return <AppShell />
}
