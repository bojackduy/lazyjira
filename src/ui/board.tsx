import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useIcons } from "../context/icons"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { BoardLocation, IssueSummary } from "../state/app-state"
import type { BoardCellItem } from "../state/board-navigation"
import { selectedBoardItemLocation } from "../state/board-navigation"
import { boardView } from "../state/board-view"
import { routeBindingsBlocked } from "../state/keyboard-context"
import { configuredIssueTypes, configuredStatuses } from "../state/config-drafts"
import { issueByKey } from "../state/issue-drafts"
import { ParentBadge } from "./parent-badge"
import { boardIssuePageSourceId, issuePageStatusText } from "../state/issue-pages"
import {
  activeSprint,
  boardGroupByForMode,
  boardIssuesForMode,
  boardStatusOffsetForMode,
  boardStatusWindowSize,
  groupModeLabel,
  emptyLoadedIssuesText,
  issueColor,
  issueTypeColor,
  issueTypeName,
  priorityColor,
  sprintDateRange,
  statusColor,
  visibleStatusesForBoard,
} from "../state/selectors"

export function BoardSurface(props: { mode: "active-sprint" | "kanban" }) {
  const { state } = useAppState()
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const groupBy = () => boardGroupByForMode(state, props.mode)
  const board = createMemo(() => boardView(state, props.mode))
  const groups = () => board().groups
  const visibleStatuses = () => visibleStatusesForBoard(state, props.mode, dimensions().width)
  const selectedLocation = createMemo(() => selectedBoardItemLocation(state, props.mode))
  const statusOffset = () => boardStatusOffsetForMode(state, props.mode)
  const statusWindowSize = () => boardStatusWindowSize(dimensions().width, configuredStatuses(state).length)
  const displayedStatusStart = () => Math.min(statusOffset(), Math.max(0, configuredStatuses(state).length - statusWindowSize())) + 1
  const bodyHeight = () => Math.max(5, dimensions().height - 21)
  const compactHeader = () => dimensions().width < 145
  const title = () => (props.mode === "active-sprint" ? `Active sprints: ${activeSprint(state)?.name ?? "No active sprint"}${sprintDateRange(activeSprint(state)?.startDate, activeSprint(state)?.endDate)}` : `Board: ${state.board.name}`)
  const subtitle = () =>
    props.mode === "active-sprint"
      ? (activeSprint(state)?.goal ?? "No sprint goal")
      : "Continuous-flow board using the same renderer with configurable grouping."

  useBindings(() => ({
    commands: [
      { name: `${props.mode}.scroll.down`, run: () => scrollPage(1) },
      { name: `${props.mode}.scroll.up`, run: () => scrollPage(-1) },
    ],
    bindings: state.route !== "board" || routeBindingsBlocked(state) ? [] : [
      { key: "d", cmd: `${props.mode}.scroll.down` },
      { key: { name: "d", ctrl: true }, cmd: `${props.mode}.scroll.down` },
      { key: "u", cmd: `${props.mode}.scroll.up` },
      { key: { name: "u", ctrl: true }, cmd: `${props.mode}.scroll.up` },
    ],
  }))

  createEffect(() => {
    if (state.route !== "board") return
    const location = selectedBoardItemLocation(state, props.mode)
    if (location) scrollbox?.scrollChildIntoView(boardItemElementId(props.mode, location))
  })

  function scrollPage(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== "board") return
    scrollbox?.scrollBy(delta, "viewport")
  }

  function rowsForGroup(groupIndex: number) {
    const columns = visibleStatuses().map((status) => board().cells[groupIndex]?.[board().statuses.findIndex((candidate) => candidate.id === status.id)] ?? [])
    const rowCount = Math.max(1, ...columns.map((column) => column.length))
    return Array.from({ length: rowCount }, (_, rowIndex) => columns.map((column) => column[rowIndex]))
  }

  return (
    <box flexDirection="column" gap={1} flexGrow={1} minHeight={0} overflow="hidden">
      <box flexDirection={compactHeader() ? "column" : "row"} justifyContent="space-between" gap={compactHeader() ? 1 : 0}>
        <box flexDirection="column">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>{title()}</text>
          <text fg={theme.textMuted} wrapMode="none">{subtitle()}</text>
        </box>
        <box flexDirection="column" alignItems={compactHeader() ? "flex-start" : "flex-end"}>
          <text fg={theme.text}>Group by: {groupModeLabel(groupBy())}</text>
          <text fg={theme.textSubtle}>Statuses {displayedStatusStart()}-{Math.min(displayedStatusStart() + visibleStatuses().length - 1, configuredStatuses(state).length)}/{configuredStatuses(state).length}</text>
          <Show when={props.mode === "kanban" && state.issuePageStateBySource[boardIssuePageSourceId]}>
            {(page) => <text fg={page().error ? theme.danger : page().loading ? theme.warning : theme.textSubtle} wrapMode="none">{issuePageStatusText(page())}</text>}
          </Show>
        </box>
      </box>
      <Legend statuses={visibleStatuses()} />
      <Show when={state.workspaceNotice}>
        {(notice) => <text fg={theme.warning}>{notice()}</text>}
      </Show>
      <Show when={props.mode === "active-sprint" && !activeSprint(state)}>
        <text fg={theme.warning}>No active sprint is available. Open Backlog to plan work.</text>
      </Show>
      <Show when={(props.mode === "kanban" || !!activeSprint(state)) && !boardIssuesForMode(state, props.mode).length}>
        <text fg={theme.textMuted}>{emptyLoadedIssuesText(state, props.mode === "kanban" ? "board issues" : "active sprint issues")}</text>
      </Show>
      <Show when={props.mode === "kanban" || !!activeSprint(state)}>
        <scrollbox
        ref={(element: ScrollBoxRenderable) => (scrollbox = element)}
        width="100%"
        height={bodyHeight()}
        scrollY={true}
        viewportCulling={true}
        viewportOptions={{ paddingRight: 1 }}
        verticalScrollbarOptions={{ visible: true, trackOptions: { backgroundColor: theme.panel, foregroundColor: theme.border } }}
      >
        <For each={groups()} fallback={<text fg={theme.textSubtle}>No issues match the active filters.</text>}>
          {(group, groupIndex) => (
            <>
              <box flexDirection="row" justifyContent="space-between" flexShrink={0} marginTop={1} paddingRight={1}>
                <text attributes={TextAttributes.BOLD} fg={theme.text} wrapMode="none">{group.label}</text>
                <text fg={theme.textSubtle} wrapMode="none">{group.issueKeys.length} issues</text>
              </box>
              <box flexDirection="row" gap={1} flexShrink={0} paddingRight={1}>
                <For each={visibleStatuses()}>
                  {(status) => <text fg={status.color} width={19} flexShrink={0} wrapMode="none">{status.name}</text>}
                </For>
              </box>
              <For each={rowsForGroup(groupIndex())}>
                {(row, rowIndex) => (
                  <box flexDirection="row" gap={1} flexShrink={0} paddingRight={1}>
                    <For each={row}>
                      {(item, statusWindowIndex) => {
                        const location = { groupIndex: groupIndex(), statusIndex: board().statuses.findIndex((status) => status.id === visibleStatuses()[statusWindowIndex()]?.id), itemIndex: rowIndex() }
                        return <IssueCell item={item} location={location} mode={props.mode} selected={sameBoardLocation(selectedLocation(), location)} />
                      }}
                    </For>
                  </box>
                )}
              </For>
            </>
          )}
        </For>
        </scrollbox>
      </Show>
    </box>
  )
}

function IssueCell(props: { item?: BoardCellItem; location: BoardLocation; mode: "active-sprint" | "kanban"; selected: boolean }) {
  const { state } = useAppState()
  if (!props.item) return <box width={19} height={5} flexShrink={0} />
  if (props.item.kind === "create") return <CreateIssueCard location={props.location} mode={props.mode} selected={props.selected} />
  const issue = issueByKey(state, props.item.issueKey)
  if (!issue) return <box width={19} height={5} flexShrink={0} />
  return <IssueCard issue={issue} selected={props.selected} id={boardItemElementId(props.mode, props.location)} />
}

function IssueCard(props: { issue: IssueSummary; selected: boolean; id: string }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const issueType = () => configuredIssueTypes(state).find((type) => type.id === props.issue.type || type.name === props.issue.type || type.name === props.issue.typeName)
  const typeColor = () => issueTypeColor(state, props.issue)
  const borderColor = () => (props.selected ? theme.borderActive : statusColor(state, props.issue))
  const typeIcon = () => icons.issueType({ name: issueTypeName(state, props.issue), subtask: issueType()?.subtask, hierarchyLevel: issueType()?.hierarchyLevel ?? props.issue.typeHierarchyLevel })
  const signal = () => (props.issue.blocked ? ` · ${icons.catalog.exceptional.blocked} blocked` : props.issue.staleDays >= 7 ? ` · ${icons.catalog.exceptional.stale} stale ${props.issue.staleDays}d` : "")

  return (
    <box id={props.id} width={19} height={5} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? "#172554" : undefined} border={["left"]} borderColor={borderColor()} overflow="hidden">
      <text fg={props.selected ? theme.selectedText : theme.text} wrapMode="none">
        <span style={{ fg: typeColor() }}>{typeIcon()} </span>
        <span style={{ fg: issueColor(state, props.issue) }}>{props.issue.key}</span>
      </text>
      <text fg={props.selected ? theme.selectedText : theme.textMuted} wrapMode="none">{props.issue.title}</text>
      <text fg={theme.textSubtle} wrapMode="none">
        {issueTypeName(state, props.issue)} · <span style={{ fg: priorityColor(props.issue) }}>{props.issue.priority}</span>{signal()}
      </text>
      <ParentBadge issue={props.issue} />
    </box>
  )
}

function CreateIssueCard(props: { location: BoardLocation; mode: "active-sprint" | "kanban"; selected: boolean }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const status = () => configuredStatuses(state)[props.location.statusIndex]

  return (
    <box id={boardItemElementId(props.mode, props.location)} width={19} height={5} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? theme.selected : undefined} border={["left"]} borderColor={props.selected ? theme.borderActive : theme.border} overflow="hidden">
      <text fg={props.selected ? theme.selectedText : theme.textMuted} wrapMode="none">{icons.catalog.structural.create} New issue</text>
      <text fg={props.selected ? theme.selectedText : status()?.color ?? theme.textSubtle} wrapMode="none">{status()?.name ?? "Status"}</text>
      <text fg={props.selected ? theme.selectedText : theme.textSubtle} wrapMode="none">enter/n create</text>
    </box>
  )
}

function Legend(props: { statuses: ReturnType<typeof visibleStatusesForBoard> }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" flexWrap="wrap" gap={1}>
        <For each={configuredIssueTypes(state)}>
          {(issueType) => <text fg={theme.textSubtle} flexShrink={0} wrapMode="none"><span style={{ fg: issueType.color }}>{icons.issueType(issueType)}</span> {shortType(issueType.name)}</text>}
        </For>
      </box>
      <box flexDirection="row" flexWrap="wrap" gap={1}>
        <For each={props.statuses}>
          {(status) => <text fg={theme.textSubtle} flexShrink={0} wrapMode="none"><span style={{ fg: status.color }}>{icons.status(status)}</span> {status.name}</text>}
        </For>
      </box>
    </box>
  )
}

function shortType(name: string) {
  if (name === "Feature") return "Feat"
  if (name === "Subtask") return "Sub"
  return name
}

function sameBoardLocation(left: BoardLocation | undefined, right: BoardLocation) {
  return !!left && left.groupIndex === right.groupIndex && left.statusIndex === right.statusIndex && left.itemIndex === right.itemIndex
}

function boardItemElementId(mode: "active-sprint" | "kanban", location: BoardLocation) {
  return `${mode}-board-item-${location.groupIndex}-${location.statusIndex}-${location.itemIndex}`
}
