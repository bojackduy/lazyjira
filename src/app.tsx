import { useTerminalDimensions } from "@opentui/solid"
import { batch, createEffect } from "solid-js"
import { useBindings } from "./context/keymap"
import { useAppState } from "./context/app-state"
import { useConfig } from "./context/config"
import { useExit } from "./context/exit"
import { useToast } from "./context/toast"
import { useIcons } from "./context/icons"
import { AppShell } from "./ui/shell"
import { configuredIssueTypes, configuredStatuses } from "./state/config-drafts"
import { issueByKey } from "./state/issue-drafts"
import { issueFields } from "./state/issue-fields"
import { backlogIssuePageSourceId, boardIssuePageSourceId, issuePageCanLoadMore, projectListIssuePageSourceId, sprintIssuePageSourceId } from "./state/issue-pages"
import { boardCapabilities, boardModeForBoard, sidebarRoutesForBoard } from "./state/routes"
import { searchPaletteCommands } from "./keymap/commands"
import type { BoardLocation, BoardMode, IssueSummary } from "./state/app-state"
import { iconModes } from "./icons/catalog"
import { projectListIssues, projectListMaxHorizontalOffset, projectListRows, projectListSelection, projectListViewportWidth } from "./state/project-list"
import { panTimelineWindow, projectTimelineViewRows, timelineCreateRowKey, timelineModel, timelineSelection, timelineSelectionAction, timelineSelectionKeys, timelineUnparentedExpandedKey, timelineUnparentedSectionKey } from "./state/timeline"
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
  backlogCreateSprintId,
  groupBacklogIssues,
  highestLevelIssueType,
  nextBacklogGroupBy,
  nextBoardGroupBy,
  visibleStatusesForBoard,
} from "./state/selectors"

export function App() {
  const appState = useAppState()
  const { state } = appState
  const dimensions = useTerminalDimensions()
  const exit = useExit()
  const config = useConfig()
  const toast = useToast()
  const icons = useIcons()

  createEffect(() => {
    if (state.route === "board") ensureSelectedIssue(visibleBoardIssueKeys(currentBoardMode()))
    if (state.route === "backlog") ensureSelectedIssue(groupBacklogIssues(state, state.backlogGroupBy).flatMap((group) => group.issueKeys))
    if (state.route === "list") ensureProjectListSelection()
    if (state.route === "timeline") ensureTimelineSelection()
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
          if (state.commandPaletteOpen) {
            appState.closeCommandPalette()
            return
          }
          if (state.iconModePickerOpen) {
            appState.closeIconModePicker()
            return
          }
          if (state.helpOpen) {
            appState.closeHelp()
            return
          }
          if (state.searchOpen) {
            appState.closeSearch()
            return
          }
          if (state.commentEditing) {
            appState.cancelComment()
            return
          }
          if (state.authOnboarding.open) return false
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
          else if (state.commandPaletteOpen) appState.closeCommandPalette()
          else if (state.iconModePickerOpen) appState.closeIconModePicker()
          else if (state.helpOpen) appState.closeHelp()
          else if (state.searchOpen) appState.closeSearch()
          else if (state.pendingDeleteIssueKey) appState.cancelIssueDelete()
          else if (state.route === "workspace" && state.workspaceFocusedArea === "results") appState.closeWorkspaceResults()
          else if (state.configEditing) appState.cancelConfigEdit()
          else if (state.detailBodyEditing) appState.cancelDetailBodyEdit()
          else if (state.commentEditing) appState.cancelComment()
          else if (state.route === "issue-detail") appState.closeIssueDetail()
          else appState.cancelInspectorEdit()
        },
      },
      { name: "edit.stage", run: () => stageCurrentEdit() },
      { name: "help.open", run: () => (canRunGlobalShortcut() ? appState.openHelp() : false) },
      { name: "help.close", run: () => (state.helpOpen ? appState.closeHelp() : false) },
      { name: "command-palette.open", run: () => (canRunGlobalShortcut() ? appState.openCommandPalette() : false) },
      { name: "command-palette.close", run: () => (state.commandPaletteOpen ? appState.closeCommandPalette() : false) },
      { name: "command-palette.next", run: () => moveCommandPaletteSelection(1) },
      { name: "command-palette.previous", run: () => moveCommandPaletteSelection(-1) },
      { name: "icons.change", run: () => (canRunGlobalShortcut() ? appState.openIconModePicker(Math.max(0, iconModes.indexOf(icons.mode))) : false) },
      { name: "icons.close", run: () => (state.iconModePickerOpen ? appState.closeIconModePicker() : false) },
      { name: "icons.next", run: () => (state.iconModePickerOpen ? appState.moveIconModePickerSelection(1, iconModes.length) : false) },
      { name: "icons.previous", run: () => (state.iconModePickerOpen ? appState.moveIconModePickerSelection(-1, iconModes.length) : false) },
      { name: "icons.select", run: () => selectIconMode() },
      { name: "route.workspace", run: () => (canRunGlobalShortcut() ? appState.setRoute("workspace") : false) },
      { name: "route.timeline", run: () => (canRunGlobalShortcut() ? appState.setRoute("timeline") : false) },
      { name: "route.backlog", run: () => (canRunGlobalShortcut() ? appState.setRoute("backlog") : false) },
      { name: "route.list", run: () => (canRunGlobalShortcut() ? appState.setRoute("list") : false) },
      { name: "route.board", run: () => (canRunGlobalShortcut() ? appState.setRoute("board") : false) },
      { name: "route.config", run: () => (canRunGlobalShortcut() ? appState.setRoute("config") : false) },
      { name: "project.switch", run: () => (canRunGlobalShortcut() ? appState.openProjectPicker() : false) },
      { name: "search.open", run: () => (canRunGlobalShortcut() && state.route !== "config" ? appState.openSearch() : false) },
      { name: "search.remote-open", run: () => (canRunGlobalShortcut() && state.route !== "config" ? appState.openRemoteSearch() : false) },
      { name: "issue.refresh-detail", run: () => refreshSelectedIssueDetail() },
      { name: "workspace.refresh", run: () => refreshWorkspace() },
      { name: "issue.load-more", run: () => loadMoreIssues() },
      { name: "issue.comment", run: () => commentSelectedIssue() },
      { name: "issue.assign", run: () => assignSelectedIssue() },
      { name: "issue.status", run: () => editSelectedIssueStatus() },
      { name: "issue.open-browser", run: () => openSelectedIssueInBrowser() },
      { name: "issue.open-parent", run: () => (canRunGlobalShortcut() ? appState.openParentIssue() : false) },
      { name: "issue.priority", run: () => editSelectedIssuePriority() },
      { name: "issue.rank-down", run: () => rankSelectedBacklogIssue("after") },
      { name: "issue.rank-up", run: () => rankSelectedBacklogIssue("before") },
      { name: "issue.move", run: () => moveSelectedBacklogIssue() },
      { name: "focus.next", run: () => (isPlainTextEditing() || isPopupOpen() ? false : appState.focusNextPane(1)) },
      { name: "focus.previous", run: () => (isPlainTextEditing() || isPopupOpen() ? false : appState.focusNextPane(-1)) },
      { name: "pane.down", run: () => moveVertical(1) },
      { name: "pane.up", run: () => moveVertical(-1) },
      { name: "pane.right", run: () => moveHorizontal(1) },
      { name: "pane.left", run: () => moveHorizontal(-1) },
      { name: "pane.enter", run: () => openFocusedItem() },
      { name: "sidebar.toggle-filter", run: () => toggleSpaceAction() },
      { name: "staged-discard.down", run: () => state.inspectorUserPicker ? appState.moveInspectorChoice(1) : (state.stagedDiscardOpen ? appState.moveStagedDiscardSelection(1) : moveVertical(1)) },
      { name: "staged-discard.up", run: () => state.inspectorUserPicker ? appState.moveInspectorChoice(-1) : (state.stagedDiscardOpen ? appState.moveStagedDiscardSelection(-1) : moveVertical(-1)) },
      { name: "staged-discard.confirm", run: () => (state.stagedDiscardOpen ? appState.confirmStagedDiscard() : openFocusedItem()) },
      { name: "staged-discard.toggle", run: () => (state.stagedDiscardOpen ? appState.toggleStagedDiscardSelection() : toggleSpaceAction()) },
      { name: "group.cycle", run: () => cycleGroup() },
      { name: "pane.bottom", run: () => moveToBoundary("last") },
      { name: "issue.edit", run: () => editSelectedIssue() },
      { name: "issue.new", run: () => createIssueFromContext() },
      { name: "config.color", run: () => colorConfigRow() },
      { name: "issue.apply", run: () => writeStagedRender() },
      { name: "issue.remote-apply", run: () => remoteApplyAction() },
      { name: "issue.delete", run: () => deleteOrRemoveSelection() },
      { name: "issue.confirm-delete", run: () => (canRunGlobalShortcut() ? appState.confirmIssueDelete() : false) },
      { name: "issue.cancel-delete", run: () => (canRunGlobalShortcut() ? appState.cancelIssueDelete() : false) },
      { name: "staged-discard.open", run: () => (isPlainTextEditing() || isPopupOpen() || isAnyEditing() ? false : appState.openStagedDiscard()) },
    ],
    bindings: state.iconModePickerOpen ? iconModePickerBindings() : state.commandPaletteOpen ? commandPaletteBindings() : state.helpOpen ? helpBindings() : state.searchOpen ? searchBindings() : [
      { key: "q", cmd: "app.quit", preventDefault: false },
      { key: { name: "c", ctrl: true }, cmd: "app.force-quit" },
      { key: "escape", cmd: "edit.cancel" },
      { key: { name: "return", ctrl: true }, cmd: "edit.stage" },
      { key: "tab", cmd: "focus.next", preventDefault: false },
      { key: { name: "tab", shift: true }, cmd: "focus.previous", preventDefault: false },
      { key: "1", cmd: "route.workspace", preventDefault: false },
      { key: "2", cmd: "route.timeline", preventDefault: false },
      { key: "3", cmd: "route.backlog", preventDefault: false },
      { key: "4", cmd: "route.list", preventDefault: false },
      { key: "5", cmd: "route.board", preventDefault: false },
      { key: { name: "p", shift: true }, cmd: "project.switch", preventDefault: false },
      { key: "?", cmd: "help.open", preventDefault: false },
      { key: "p", cmd: "issue.priority", preventDefault: false },
      { key: ";", cmd: "command-palette.open", preventDefault: false },
      { key: ":", cmd: "command-palette.open", preventDefault: false },
      { key: "/", cmd: "search.open", preventDefault: false },
      { key: { name: "s", shift: true }, cmd: "search.remote-open", preventDefault: false },
      { key: "r", cmd: "issue.refresh-detail", preventDefault: false },
      { key: { name: "r", shift: true }, cmd: "workspace.refresh", preventDefault: false },
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
      { key: { name: "g", shift: true }, cmd: "pane.bottom", preventDefault: false },
      { key: "e", cmd: "issue.edit", preventDefault: false },
      { key: "n", cmd: "issue.new", preventDefault: false },
      { key: "a", cmd: "issue.assign", preventDefault: false },
      { key: "s", cmd: "issue.status", preventDefault: false },
      { key: "o", cmd: "issue.open-browser", preventDefault: false },
      { key: "c", cmd: "issue.comment", preventDefault: false },
      { key: "m", cmd: "issue.move", preventDefault: false },
      { key: { name: "j", shift: true }, cmd: "issue.rank-down", preventDefault: false },
      { key: { name: "k", shift: true }, cmd: "issue.rank-up", preventDefault: false },
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

  function iconModePickerBindings() {
    return [
      { key: "escape", cmd: "icons.close", preventDefault: false },
      { key: "q", cmd: "icons.close", preventDefault: false },
      { key: "down", cmd: "icons.next", preventDefault: false },
      { key: "j", cmd: "icons.next", preventDefault: false },
      { key: "up", cmd: "icons.previous", preventDefault: false },
      { key: "k", cmd: "icons.previous", preventDefault: false },
      { key: "return", cmd: "icons.select", preventDefault: false },
    ]
  }

  function commandPaletteBindings() {
    return [
      { key: "escape", cmd: "command-palette.close", preventDefault: false },
      { key: "down", cmd: "command-palette.next", preventDefault: false },
      { key: "up", cmd: "command-palette.previous", preventDefault: false },
      { key: { name: "n", ctrl: true }, cmd: "command-palette.next", preventDefault: false },
      { key: { name: "p", ctrl: true }, cmd: "command-palette.previous", preventDefault: false },
    ]
  }

  function helpBindings() {
    return [
      { key: "escape", cmd: "help.close", preventDefault: false },
      { key: "q", cmd: "help.close", preventDefault: false },
    ]
  }

  function moveCommandPaletteSelection(delta: number) {
    if (!state.commandPaletteOpen) return false
    appState.moveCommandPaletteSelection(delta, searchPaletteCommands(state.commandPaletteQuery, state.board).length)
  }

  async function selectIconMode() {
    if (!state.iconModePickerOpen) return false
    if (icons.locked) {
      toast.show("LAZYJIRA_ICON_MODE overrides icon selection")
      appState.closeIconModePicker()
      return
    }
    const mode = iconModes[state.iconModePickerSelectedIndex]
    if (!mode) return false
    try {
      await icons.setMode(mode)
      toast.show(`Icon mode changed to ${mode}`)
    } catch (error) {
      toast.show(`Icon mode changed for this session but could not be saved: ${error instanceof Error ? error.message : String(error)}`)
    }
    appState.closeIconModePicker()
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
      if (state.inspectorEditingFieldId === "statusId" || state.inspectorEditingFieldId === "type" || state.inspectorEditingFieldId === "parentKey" || state.inspectorEditingFieldId === "sprintId") {
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
    if (state.route === "board") moveBoardVertical(currentBoardMode(), delta)
    if (state.route === "backlog") moveBacklogSelection(delta)
    if (state.route === "list") moveProjectList(delta)
    if (state.route === "timeline") moveTimeline(delta)
  }

  function moveHorizontal(delta: number) {
    if (isPlainTextEditing() || isPopupOpen()) return false
    if (state.focusedPane === "sidebar" && delta > 0) {
      appState.openSidebarSelection()
      if (state.sidebarSelectedIndex < sidebarRoutesForBoard(state.board).length) appState.setFocusedPane("main")
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
    if (state.route === "board") moveBoardHorizontal(currentBoardMode(), delta)
    if (state.route === "backlog") moveBacklogGroup(delta)
    if (state.route === "list") moveProjectListHorizontal(delta)
    if (state.route === "timeline") appState.setTimelineWindowStart(panTimelineWindow(state.timelineWindowStart, state.timelineZoom, delta))
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
      if (state.sidebarSelectedIndex < sidebarRoutesForBoard(state.board).length) appState.setFocusedPane("main")
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
    if (state.route === "board") {
      const mode = currentBoardMode()
      const location = selectedBoardItemLocation(state, mode)
      const issueKey = location ? boardIssueKeyAtLocation(state, mode, location) : undefined
      if (issueKey) appState.openIssueDetail(issueKey)
      else createIssueFromContext()
      return
    }
    if (state.route === "backlog") {
      const focusedGroup = groupBacklogIssues(state, state.backlogGroupBy).find((group) => group.id === state.selectedBacklogGroupId)
      const issueKey = focusedGroup?.issueKeys.includes(state.selectedIssueKey) ? state.selectedIssueKey : focusedGroup?.issueKeys[0]
      if (issueKey) appState.openIssueDetail(issueKey)
      else createIssueFromContext()
      return
    }
    if (state.route === "list" && state.projectListSelectedIssueKey) appState.openIssueDetail(state.projectListSelectedIssueKey)
    if (state.route === "timeline") {
      const action = timelineSelectionAction(state.timelineSelectedIssueKey)
      if (action === "toggle-unparented") appState.toggleTimelineParentCollapsed(timelineUnparentedExpandedKey)
      else if (action === "create") createIssueFromContext()
      else if (action === "open-issue") appState.openIssueDetail(state.timelineSelectedIssueKey!)
    }
  }

  function cycleGroup() {
    if (!canRunGlobalShortcut()) return false
    if (state.focusedPane !== "main") return
    if (state.route === "list") {
      moveToBoundary("first")
      return
    }
    if (state.route === "timeline") {
      moveToBoundary("first")
      return
    }
    if (state.route === "board" && currentBoardMode() === "active-sprint") {
      appState.setActiveSprintGroupBy(nextBoardGroupBy(state.activeSprintGroupBy))
      appState.setActiveSprintStatusOffset(0)
    }
    if (state.route === "board" && currentBoardMode() === "kanban") {
      appState.setKanbanGroupBy(nextBoardGroupBy(state.kanbanGroupBy))
      appState.setKanbanStatusOffset(0)
    }
    if (state.route === "backlog" && boardCapabilities(state.board).supportsSprintBacklog) appState.setBacklogGroupBy(nextBacklogGroupBy(state.backlogGroupBy))
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
    if (!state.issues[state.selectedIssueKey]) return false
    if (state.focusedPane !== "inspector") {
      appState.setFocusedPane("inspector")
      appState.startInspectorEdit()
      return
    }
    appState.startInspectorEdit()
  }

  function editSelectedIssuePriority() {
    return editSelectedIssueField("priority")
  }

  function assignSelectedIssue() {
    if (state.route === "config") {
      appState.startConfigAdd()
      return
    }
    return editSelectedIssueField("assignee")
  }

  function editSelectedIssueStatus() {
    return editSelectedIssueField("statusId")
  }

  function editSelectedIssueField(fieldId: "assignee" | "priority" | "statusId") {
    if (isPlainTextEditing() || isPopupOpen() || state.route === "workspace" || state.route === "config" || !state.issues[state.selectedIssueKey]) return false
    const fieldIndex = issueFields.findIndex((field) => field.id === fieldId)
    if (fieldIndex < 0) return false
    appState.moveInspectorSelection(fieldIndex - state.inspectorSelectedFieldIndex)
    appState.setFocusedPane("inspector")
    appState.startInspectorEdit()
  }

  function openSelectedIssueInBrowser() {
    if (!canRunGlobalShortcut() || state.route === "workspace" || state.route === "config" || !state.issues[state.selectedIssueKey]) return false
    if (!config.jira?.baseUrl) {
      toast.show("Open in browser requires a configured Jira site URL")
      return false
    }
    const url = `${config.jira.baseUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(state.selectedIssueKey)}`
    try {
      Bun.spawn(browserOpenCommand(url), { stdout: "ignore", stderr: "ignore" }).unref()
      toast.show(`Opening ${state.selectedIssueKey} in Jira`)
    } catch (error) {
      toast.show(`Could not open Jira: ${error instanceof Error ? error.message : String(error)}`)
    }
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
    const boardMode = state.route === "board" ? currentBoardMode() : undefined
    const location = boardMode ? selectedBoardItemLocation(state, boardMode) : undefined
    const statuses = configuredStatuses(state)
    const selectedIssueKey = boardMode && location ? boardIssueKeyAtLocation(state, boardMode, location) : undefined
    const backlogGroup = state.route === "backlog" ? groupBacklogIssues(state, state.backlogGroupBy).find((group) => group.id === state.selectedBacklogGroupId) : undefined
    const backlogGroupIssueKey = backlogGroup?.issueKeys[0]
    const current = selectedIssueKey ? state.issues[selectedIssueKey] : (backlogGroupIssueKey ? state.issues[backlogGroupIssueKey] : state.issues[state.selectedIssueKey])
    const groupIssue = boardMode && location ? firstIssueInBoardGroup(location, boardMode) : undefined
    const defaultSource = boardMode ? (current ?? groupIssue) : current
    const statusId = location ? statuses[location.statusIndex]?.id : current?.statusId
    const key = `DRAFT-${state.draftIssueCounter}`
    const groupDefaults = defaultSource && boardMode ? defaultsFromBoardGroup(defaultSource, boardGroupByForMode(state, boardMode)) : {}
    const defaultType = state.route === "timeline" && state.timelineSelectedIssueKey === timelineCreateRowKey ? highestLevelIssueType(state) : configuredIssueTypes(state).find((type) => !type.subtask) ?? configuredIssueTypes(state)[0]
    const type = groupDefaults.type ?? defaultType?.id ?? "Task"
    const issue: IssueSummary = {
      key,
      title: "New issue",
      type,
      typeName: configuredIssueTypes(state).find((candidate) => candidate.id === type || candidate.name === type)?.name,
      priority: groupDefaults.priority ?? defaultSource?.priority ?? "Medium",
      statusId: statusId ?? statuses[0]?.id ?? "todo",
      assignee: groupDefaults.assignee ?? defaultSource?.assignee ?? state.currentUser,
      reporter: state.currentUser,
      epic: groupDefaults.epic ?? defaultSource?.epic,
      feature: groupDefaults.feature ?? defaultSource?.feature,
      space: groupDefaults.space ?? defaultSource?.space,
      sprintId: state.route === "list" || state.route === "timeline" ? undefined : boardMode === "active-sprint" ? state.activeSprintId : state.route === "backlog" || boardMode === "kanban" ? backlogCreateSprintId(state) : defaultSource?.sprintId,
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
    if (state.focusedPane === "sidebar") {
      appState.toggleSidebarFilterSelection()
      return
    }
    if (state.focusedPane === "main" && state.route === "backlog") appState.toggleBacklogGroupCollapsed(state.selectedBacklogGroupId)
    if (state.focusedPane === "main" && state.route === "list") {
      const row = projectListRows(state).find((candidate) => candidate.issue.key === state.projectListSelectedIssueKey)
      if (row?.hasChildren) appState.toggleProjectListParentCollapsed(row.issue.key)
    }
    if (state.focusedPane === "main" && state.route === "timeline") {
      if (state.timelineSelectedIssueKey === timelineUnparentedSectionKey) {
        appState.toggleTimelineParentCollapsed(timelineUnparentedExpandedKey)
        return
      }
      const row = visibleTimelineRows().find((candidate) => candidate.kind === "issue" && candidate.issue.key === state.timelineSelectedIssueKey)
      if (row?.kind === "issue" && row.hasChildren) appState.toggleTimelineParentCollapsed(row.issue.key)
    }
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
    if (state.commentEditing) {
      appState.commitComment()
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

  function commentSelectedIssue() {
    if (isPlainTextEditing() || isPopupOpen()) return false
    if (state.route === "config") {
      appState.startConfigColor()
      return
    }
    if (!state.issues[state.selectedIssueKey]) return false
    appState.startComment()
  }

  function rankSelectedBacklogIssue(position: "before" | "after") {
    if (!canRunGlobalShortcut() || state.route !== "backlog" || state.focusedPane !== "main") return false
    if (state.collapsedBacklogGroupIds.includes(state.selectedBacklogGroupId)) return false
    const issueKeys = groupBacklogIssues(state, state.backlogGroupBy).find((group) => group.id === state.selectedBacklogGroupId)?.issueKeys ?? []
    const index = issueKeys.indexOf(state.selectedIssueKey)
    const targetIssueKey = issueKeys[index + (position === "before" ? -1 : 1)]
    if (!targetIssueKey) return false
    appState.stageIssueRank(state.selectedIssueKey, targetIssueKey, position)
  }

  function moveSelectedBacklogIssue() {
    if (!canRunGlobalShortcut() || state.route !== "backlog" || state.focusedPane !== "main" || !boardCapabilities(state.board).supportsSprintBacklog) return false
    const fieldIndex = issueFields.findIndex((field) => field.id === "sprintId")
    if (fieldIndex < 0 || !state.selectedIssueKey) return false
    appState.moveInspectorSelection(fieldIndex - state.inspectorSelectedFieldIndex)
    appState.setFocusedPane("inspector")
    appState.startInspectorEdit()
  }

  function remoteApplyAction() {
    if (isPlainTextEditing() || state.stagedDiscardOpen) return false
    if (state.remoteApplyOpen) {
      void appState.confirmRemoteIssueApply()
      return
    }
    appState.openRemoteIssueApply()
  }

  function refreshSelectedIssueDetail() {
    if (!canRunGlobalShortcut()) return false
    if (state.route === "list" || state.route === "timeline") {
      void appState.loadIssuePage(projectListIssuePageSourceId, true)
      return
    }
    if (state.workspaceLoadError) {
      appState.retryWorkspaceLoad()
      return
    }
    if (state.workspaceLoading) return false
    if (state.route !== "issue-detail") return false
    void appState.loadIssueDetail()
  }

  function refreshWorkspace() {
    if (!canRunGlobalShortcut()) return false
    appState.refreshWorkspace()
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
    if (state.route === "list" || state.route === "timeline") return issuePageCanLoadMore(state.issuePageStateBySource[projectListIssuePageSourceId]) ? projectListIssuePageSourceId : undefined
    if (state.route === "board" && currentBoardMode() === "kanban") return boardIssuePageSourceId
    if (state.route !== "backlog") return undefined
    if (!boardCapabilities(state.board).supportsSprintBacklog) return issuePageCanLoadMore(state.issuePageStateBySource[backlogIssuePageSourceId]) ? backlogIssuePageSourceId : undefined
    if (state.backlogGroupBy === "sprint") {
      const focusedSourceId = state.selectedBacklogGroupId === "backlog" ? backlogIssuePageSourceId : sprintIssuePageSourceId(state.selectedBacklogGroupId)
      if (issuePageCanLoadMore(state.issuePageStateBySource[focusedSourceId])) return focusedSourceId
    }
    const selectedIssue = issueByKey(state, state.selectedIssueKey)
    const selectedSourceId = selectedIssue?.sprintId ? sprintIssuePageSourceId(selectedIssue.sprintId) : backlogIssuePageSourceId
    if (issuePageCanLoadMore(state.issuePageStateBySource[selectedSourceId])) return selectedSourceId
    return [
      ...state.sprints.map((sprint) => sprintIssuePageSourceId(sprint.id)),
      backlogIssuePageSourceId,
    ].find((sourceId) => issuePageCanLoadMore(state.issuePageStateBySource[sourceId]))
  }

  function isPopupOpen() {
    return state.remoteApplyOpen || state.stagedDiscardOpen || state.authOnboarding.open || state.projectPicker.open || state.commandPaletteOpen || state.iconModePickerOpen || state.helpOpen || state.commentEditing
  }

  function isPlainTextEditing() {
    return state.authOnboarding.open || state.projectPicker.open || state.commandPaletteOpen || state.iconModePickerOpen || state.helpOpen || state.searchOpen || state.detailBodyEditing || state.commentEditing || !!state.configEditing || (!!state.inspectorEditingFieldId && state.inspectorEditingFieldId !== "statusId" && state.inspectorEditingFieldId !== "type" && state.inspectorEditingFieldId !== "parentKey" && state.inspectorEditingFieldId !== "sprintId")
  }

  function isAnyEditing() {
    return state.authOnboarding.open || state.projectPicker.open || state.detailBodyEditing || state.commentEditing || !!state.inspectorEditingFieldId || !!state.configEditing
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
    if (!state.issues[state.selectedIssueKey]) return false
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
    if (state.collapsedBacklogGroupIds.includes(state.selectedBacklogGroupId)) return
    const groups = groupBacklogIssues(state, state.backlogGroupBy)
    const focusedGroup = groups.find((group) => group.id === state.selectedBacklogGroupId)
    const keys = focusedGroup?.issueKeys ?? groups.flatMap((group) => group.issueKeys)
    if (!keys.length) {
      const fallbackGroup = groups.find((group) => group.issueKeys.length && !state.collapsedBacklogGroupIds.includes(group.id))
      const fallbackIssueKey = delta > 0 ? fallbackGroup?.issueKeys[0] : fallbackGroup?.issueKeys.at(-1)
      if (fallbackGroup) appState.setSelectedBacklogGroup(fallbackGroup.id)
      if (fallbackIssueKey) appState.selectIssue(fallbackIssueKey)
      return
    }
    const currentIndex = keys.indexOf(state.selectedIssueKey)
    const startIndex = currentIndex === -1 ? 0 : currentIndex
    appState.selectIssue(keys[(startIndex + delta + keys.length) % keys.length] ?? keys[0]!)
  }

  function moveBacklogGroup(delta: number) {
    const groups = groupBacklogIssues(state, state.backlogGroupBy)
    if (!groups.length) return
    const currentGroupIndex = Math.max(0, groups.findIndex((group) => group.id === state.selectedBacklogGroupId))
    const nextGroup = groups[(currentGroupIndex + delta + groups.length) % groups.length]
    if (!nextGroup) return
    const firstIssueKey = nextGroup?.issueKeys[0]
    batch(() => {
      appState.setSelectedBacklogGroup(nextGroup.id)
      if (firstIssueKey) appState.selectIssue(firstIssueKey)
    })
  }

  function moveProjectList(delta: number) {
    const keys = projectListIssues(state).map((issue) => issue.key)
    appState.setProjectListSelection(projectListSelection(keys, state.projectListSelectedIssueKey, delta))
  }

  function moveTimeline(delta: number) {
    appState.setTimelineSelection(timelineSelection(visibleTimelineRows(), state.timelineSelectedIssueKey, delta))
  }

  function moveToBoundary(boundary: "first" | "last") {
    if (!canRunGlobalShortcut() || state.focusedPane !== "main" || (state.route !== "list" && state.route !== "timeline")) return false
    if (state.route === "timeline") {
      appState.setTimelineSelection(timelineSelection(visibleTimelineRows(), state.timelineSelectedIssueKey, boundary))
      return
    }
    const keys = projectListIssues(state).map((issue) => issue.key)
    appState.setProjectListSelection(projectListSelection(keys, state.projectListSelectedIssueKey, boundary))
  }

  function moveProjectListHorizontal(delta: number) {
    const maxOffset = projectListMaxHorizontalOffset(projectListViewportWidth(dimensions().width))
    appState.setProjectListHorizontalOffset(Math.max(0, Math.min(maxOffset, state.projectListHorizontalOffset + delta)))
  }

  function ensureProjectListSelection() {
    const keys = projectListIssues(state).map((issue) => issue.key)
    const selected = keys.includes(state.projectListSelectedIssueKey ?? "") ? state.projectListSelectedIssueKey : keys[0]
    if (selected !== state.projectListSelectedIssueKey || (selected && selected !== state.selectedIssueKey)) appState.setProjectListSelection(selected)
  }

  function visibleTimelineRows() {
    return projectTimelineViewRows(timelineModel(state).rows, state.collapsedTimelineParentKeys)
  }

  function ensureTimelineSelection() {
    const rows = visibleTimelineRows()
    const model = timelineModel(state)
    if (!rows.length && !model.loaded && !state.issuePageStateBySource[projectListIssuePageSourceId]?.isLast) return
    const keys = timelineSelectionKeys(rows)
    const selected = keys.includes(state.timelineSelectedIssueKey ?? "") ? state.timelineSelectedIssueKey : keys[0]
    const selectedIssue = timelineSelectionAction(selected) === "open-issue" ? selected : undefined
    if (selected !== state.timelineSelectedIssueKey || (selectedIssue && selectedIssue !== state.selectedIssueKey)) appState.setTimelineSelection(selected)
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

  function currentBoardMode(): BoardMode {
    return boardModeForBoard(state.board)
  }

  function ensureSelectedIssue(keys: string[]) {
    if (!keys.length || keys.includes(state.selectedIssueKey)) return
    appState.selectIssue(keys[0]!)
  }

  return <AppShell />
}

export function browserOpenCommand(url: string, platform: NodeJS.Platform = process.platform) {
  if (platform === "darwin") return ["open", url]
  if (platform === "win32") return ["cmd", "/c", "start", "", url]
  return ["xdg-open", url]
}
