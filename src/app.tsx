import { useTerminalDimensions } from "@opentui/solid"
import { createEffect } from "solid-js"
import { useBindings } from "./context/keymap"
import { useAppState } from "./context/app-state"
import { useExit } from "./context/exit"
import { AppShell } from "./ui/shell"
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
          exit.exit()
        },
      },
      { name: "edit.cancel", run: () => appState.cancelInspectorEdit() },
      { name: "route.workspace", run: () => appState.setRoute("workspace") },
      { name: "route.active-sprint", run: () => appState.setRoute("active-sprint") },
      { name: "route.backlog", run: () => appState.setRoute("backlog") },
      { name: "route.kanban", run: () => appState.setRoute("kanban") },
      { name: "focus.next", run: () => appState.focusNextPane(1) },
      { name: "focus.previous", run: () => appState.focusNextPane(-1) },
      { name: "pane.down", run: () => moveVertical(1) },
      { name: "pane.up", run: () => moveVertical(-1) },
      { name: "pane.right", run: () => moveHorizontal(1) },
      { name: "pane.left", run: () => moveHorizontal(-1) },
      { name: "pane.enter", run: () => openFocusedItem() },
      { name: "sidebar.toggle-filter", run: () => state.focusedPane === "sidebar" && appState.toggleSidebarFilterSelection() },
      { name: "group.cycle", run: () => cycleGroup() },
      { name: "issue.edit", run: () => editSelectedIssue() },
      { name: "issue.new", run: () => createIssueFromContext() },
      { name: "issue.apply", run: () => appState.applyIssueChanges() },
      { name: "issue.discard-field", run: () => appState.discardInspectorFieldChange() },
    ],
    bindings: [
      { key: "q", cmd: "app.quit" },
      { key: { name: "c", ctrl: true }, cmd: "app.quit" },
      { key: "escape", cmd: "edit.cancel" },
      { key: "tab", cmd: "focus.next" },
      { key: { name: "tab", shift: true }, cmd: "focus.previous" },
      { key: "1", cmd: "route.workspace" },
      { key: "2", cmd: "route.active-sprint" },
      { key: "3", cmd: "route.backlog" },
      { key: "4", cmd: "route.kanban" },
      { key: "j", cmd: "pane.down" },
      { key: "down", cmd: "pane.down" },
      { key: "k", cmd: "pane.up" },
      { key: "up", cmd: "pane.up" },
      { key: "l", cmd: "pane.right" },
      { key: "right", cmd: "pane.right" },
      { key: "h", cmd: "pane.left" },
      { key: "left", cmd: "pane.left" },
      { key: "return", cmd: "pane.enter" },
      { key: "space", cmd: "sidebar.toggle-filter" },
      { key: "g", cmd: "group.cycle" },
      { key: "e", cmd: "issue.edit" },
      { key: "n", cmd: "issue.new" },
      { key: "w", cmd: "issue.apply" },
      { key: "x", cmd: "issue.discard-field" },
    ],
  }))

  function moveVertical(delta: number) {
    if (state.focusedPane === "sidebar") {
      appState.moveSidebarSelection(delta)
      return
    }
    if (state.focusedPane === "inspector") {
      appState.moveInspectorSelection(delta)
      return
    }
    if (state.focusedPane !== "main") return
    if (isBoardRoute(state.route)) moveBoardVertical(state.route, delta)
    if (state.route === "backlog") moveBacklogSelection(delta)
  }

  function moveHorizontal(delta: number) {
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
    if (state.focusedPane === "sidebar") {
      appState.openSidebarSelection()
      if (state.sidebarSelectedIndex < sidebarRoutes.length) appState.setFocusedPane("main")
      return
    }
    if (state.focusedPane === "inspector") {
      appState.startInspectorEdit()
      return
    }
    if (state.focusedPane !== "main") return
    if (isBoardRoute(state.route) || state.route === "backlog") appState.setFocusedPane("inspector")
  }

  function cycleGroup() {
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
    if (state.focusedPane !== "inspector") {
      appState.setFocusedPane("inspector")
      return
    }
    appState.startInspectorEdit()
  }

  function createIssueFromContext() {
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
      keys.push(...group.issueKeys.filter((issueKey) => visibleStatusIds.has(state.issues[issueKey]?.statusId ?? "")))
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
