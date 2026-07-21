import { useTerminalDimensions } from "@opentui/solid"
import { createEffect } from "solid-js"
import { useBindings } from "./context/keymap"
import { useAppState } from "./context/app-state"
import { useExit } from "./context/exit"
import { AppShell } from "./ui/shell"
import { issueByKey } from "./state/issue-drafts"
import { sidebarRoutes } from "./state/routes"
import type { BoardMode, IssueSummary } from "./state/app-state"
import {
  boardCellIssueKeys,
  boardIssueKeyAtLocation,
  firstBoardLocation,
  nextKanbanHorizontalLocation,
  selectedBoardLocation,
  type BoardLocation,
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
          if (isPlainTextEditing()) return false
          if (state.pendingDeleteIssueKey) {
            appState.cancelIssueDelete()
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
          else if (state.pendingDeleteIssueKey) appState.cancelIssueDelete()
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
      { name: "issue.apply", run: () => writeStagedRender() },
      { name: "issue.remote-apply", run: () => remoteApplyAction() },
      { name: "issue.delete", run: () => (canRunGlobalShortcut() ? appState.requestIssueDelete() : false) },
      { name: "issue.confirm-delete", run: () => (canRunGlobalShortcut() ? appState.confirmIssueDelete() : false) },
      { name: "issue.cancel-delete", run: () => (canRunGlobalShortcut() ? appState.cancelIssueDelete() : false) },
      { name: "staged-discard.open", run: () => (isPlainTextEditing() || isPopupOpen() || isAnyEditing() ? false : appState.openStagedDiscard()) },
    ],
    bindings: [
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
      { key: "w", cmd: "issue.apply", preventDefault: false },
      { key: { name: "w", shift: true }, cmd: "issue.remote-apply", preventDefault: false },
      { key: "x", cmd: "issue.delete", preventDefault: false },
      { key: "y", cmd: "issue.confirm-delete", preventDefault: false },
      { key: { name: "x", shift: true }, cmd: "staged-discard.open", preventDefault: false },
    ],
  }))

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
    if (isBoardRoute(state.route) || state.route === "backlog") appState.openIssueDetail(state.selectedIssueKey)
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
    if (state.route === "issue-detail") return
    const current = state.issues[state.selectedIssueKey]
    const boardMode = isBoardRoute(state.route) ? state.route : undefined
    const location = boardMode ? selectedBoardLocation(state, boardMode) : undefined
    const statusId = location ? state.statuses[location.statusIndex]?.id : current?.statusId
    const key = `DRAFT-${state.draftIssueCounter}`
    const groupDefaults = current && boardMode ? defaultsFromBoardGroup(current, boardGroupByForMode(state, boardMode)) : {}
    const issue: IssueSummary = {
      key,
      title: "New issue",
      type: groupDefaults.type ?? "Task",
      priority: groupDefaults.priority ?? current?.priority ?? "Medium",
      statusId: statusId ?? state.statuses[0]?.id ?? "todo",
      assignee: groupDefaults.assignee ?? current?.assignee ?? state.currentUser,
      reporter: state.currentUser,
      epic: groupDefaults.epic ?? current?.epic,
      feature: groupDefaults.feature ?? current?.feature,
      space: groupDefaults.space ?? current?.space,
      sprintId: state.route === "active-sprint" ? state.activeSprintId : current?.sprintId,
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
      labels: current?.labels ?? [],
      components: current?.components ?? [],
      blocked: false,
      staleDays: 0,
      description: "",
      comments: [],
      links: [],
    }
    appState.createDraftIssue(issue)
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
    if (isPopupOpen() || state.detailBodyEditing) return false
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

  function isPopupOpen() {
    return state.remoteApplyOpen || state.stagedDiscardOpen
  }

  function isPlainTextEditing() {
    return state.detailBodyEditing || (!!state.inspectorEditingFieldId && state.inspectorEditingFieldId !== "statusId" && state.inspectorEditingFieldId !== "type")
  }

  function isAnyEditing() {
    return state.detailBodyEditing || !!state.inspectorEditingFieldId
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
    if (mode === "active-sprint") moveSprintVertical(delta)
    else moveKanbanVertical(delta)
  }

  function moveSprintVertical(delta: number) {
    const location = selectedBoardLocation(state, "active-sprint") ?? firstBoardLocation(state, "active-sprint")
    if (!location) return
    const cell = boardCellIssueKeys(state, "active-sprint", location.groupIndex, location.statusIndex)
    const nextItemIndex = location.itemIndex + delta
    if (cell[nextItemIndex]) {
      selectBoardIssue("active-sprint", cell[nextItemIndex]!)
      return
    }

    const next = findSprintColumnWithIssue(location.statusIndex + delta, delta)
    if (!next) return
    selectBoardIssue("active-sprint", delta > 0 ? next.issueKeys[0]! : next.issueKeys[next.issueKeys.length - 1]!)
  }

  function moveKanbanVertical(delta: number) {
    const location = selectedBoardLocation(state, "kanban") ?? firstBoardLocation(state, "kanban")
    if (!location) return
    const cell = boardCellIssueKeys(state, "kanban", location.groupIndex, location.statusIndex)
    const nextItemIndex = location.itemIndex + delta
    if (cell[nextItemIndex]) {
      selectBoardIssue("kanban", cell[nextItemIndex]!)
      return
    }

    const groups = boardGroupsForMode(state, "kanban")
    for (let groupIndex = location.groupIndex + delta; groupIndex >= 0 && groupIndex < groups.length; groupIndex += delta) {
      const issueKeys = boardCellIssueKeys(state, "kanban", groupIndex, location.statusIndex)
      if (issueKeys.length) {
        selectBoardIssue("kanban", delta > 0 ? issueKeys[0]! : issueKeys[issueKeys.length - 1]!)
        return
      }
    }
  }

  function moveBoardHorizontal(mode: BoardMode, delta: number) {
    const location = selectedBoardLocation(state, mode) ?? firstBoardLocation(state, mode)
    if (!location) return
    if (mode === "kanban") {
      const next = nextKanbanHorizontalLocation(state, location, delta > 0 ? 1 : -1)
      if (next) selectBoardLocation("kanban", next)
      return
    }

    const groups = boardGroupsForMode(state, mode)
    for (let statusIndex = location.statusIndex + delta; statusIndex >= 0 && statusIndex < state.statuses.length; statusIndex += delta) {
      const issueKeys = boardCellIssueKeys(state, mode, location.groupIndex, statusIndex)
      if (!issueKeys.length) continue
      selectBoardIssue(mode, issueKeys[Math.min(location.itemIndex, issueKeys.length - 1)]!)
      return
    }

    const targetStatusIndex = Math.max(0, Math.min(state.statuses.length - 1, location.statusIndex + delta))
    ensureStatusVisible(mode, targetStatusIndex)
    if (!groups[location.groupIndex]) return
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

  function findSprintColumnWithIssue(startStatusIndex: number, delta: number) {
    for (let statusIndex = startStatusIndex; statusIndex >= 0 && statusIndex < state.statuses.length; statusIndex += delta) {
      const issueKeys = boardIssuesForMode(state, "active-sprint")
        .filter((issue) => issue.statusId === state.statuses[statusIndex]?.id)
        .map((issue) => issue.key)
      if (issueKeys.length) return { statusIndex, issueKeys }
    }
    return
  }

  function ensureStatusVisible(mode: BoardMode, statusIndex: number) {
    const windowSize = boardStatusWindowSize(dimensions().width, state.statuses.length)
    const maxOffset = Math.max(0, state.statuses.length - windowSize)
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
    if (location) ensureStatusVisible(mode, location.statusIndex)
  }

  function selectBoardLocation(mode: BoardMode, location: BoardLocation) {
    const issueKey = boardIssueKeyAtLocation(state, mode, location)
    if (issueKey) selectBoardIssue(mode, issueKey)
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
