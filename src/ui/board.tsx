import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { IssueSummary } from "../state/app-state"
import { configuredIssueTypes, configuredStatuses } from "../state/config-drafts"
import { issueByKey } from "../state/issue-drafts"
import {
  activeSprint,
  boardGroupsForMode,
  boardGroupByForMode,
  boardStatusOffsetForMode,
  boardStatusWindowSize,
  groupModeLabel,
  issueTypeColor,
  statusColor,
  visibleStatusesForBoard,
} from "../state/selectors"

export function BoardSurface(props: { mode: "active-sprint" | "kanban" }) {
  const { state } = useAppState()
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const groupBy = () => boardGroupByForMode(state, props.mode)
  const groups = () => boardGroupsForMode(state, props.mode)
  const visibleStatuses = () => visibleStatusesForBoard(state, props.mode, dimensions().width)
  const statusOffset = () => boardStatusOffsetForMode(state, props.mode)
  const statusWindowSize = () => boardStatusWindowSize(dimensions().width, configuredStatuses(state).length)
  const displayedStatusStart = () => Math.min(statusOffset(), Math.max(0, configuredStatuses(state).length - statusWindowSize())) + 1
  const bodyHeight = () => Math.max(5, dimensions().height - 21)
  const compactHeader = () => dimensions().width < 145
  const title = () => (props.mode === "active-sprint" ? `Active Sprint: ${activeSprint(state)?.name ?? "Sprint"}` : "Kanban Board")
  const subtitle = () =>
    props.mode === "active-sprint"
      ? (activeSprint(state)?.goal ?? "No sprint goal")
      : "Continuous-flow board using the same renderer with configurable grouping."

  useBindings(() => ({
    commands: [
      { name: `${props.mode}.scroll.down`, run: () => scrollPage(1) },
      { name: `${props.mode}.scroll.up`, run: () => scrollPage(-1) },
    ],
    bindings: [
      { key: "d", cmd: `${props.mode}.scroll.down` },
      { key: { name: "d", ctrl: true }, cmd: `${props.mode}.scroll.down` },
      { key: "u", cmd: `${props.mode}.scroll.up` },
      { key: { name: "u", ctrl: true }, cmd: `${props.mode}.scroll.up` },
    ],
  }))

  createEffect(() => {
    if (state.route !== props.mode) return
    scrollbox?.scrollChildIntoView(`issue-${state.selectedIssueKey}`)
  })

  function scrollPage(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== props.mode) return
    scrollbox?.scrollBy(delta, "viewport")
  }

  function rowsForGroup(issueKeys: string[]) {
    const columns = visibleStatuses().map((status) => issueKeys.filter((issueKey) => issueByKey(state, issueKey)?.statusId === status.id))
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
        </box>
      </box>
      <Legend />
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
          {(group) => (
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
              <For each={rowsForGroup(group.issueKeys)}>
                {(row) => (
                  <box flexDirection="row" gap={1} flexShrink={0} paddingRight={1}>
                    <For each={row}>
                      {(issueKey) => {
                        const issue = issueKey ? issueByKey(state, issueKey) : undefined
                        return <IssueCell issue={issue} selected={issue?.key === state.selectedIssueKey} />
                      }}
                    </For>
                  </box>
                )}
              </For>
            </>
          )}
        </For>
      </scrollbox>
    </box>
  )
}

function IssueCell(props: { issue?: IssueSummary; selected: boolean }) {
  if (!props.issue) return <box width={19} height={4} flexShrink={0} />
  return <IssueCard issue={props.issue} selected={props.selected} />
}

function IssueCard(props: { issue: IssueSummary; selected: boolean }) {
  const { state } = useAppState()
  const theme = useTheme()
  const typeColor = () => issueTypeColor(state, props.issue)
  const borderColor = () => (props.selected ? theme.borderActive : statusColor(state, props.issue))
  const signal = () => (props.issue.blocked ? " · blocked" : props.issue.staleDays >= 7 ? ` · stale ${props.issue.staleDays}d` : "")

  return (
    <box id={`issue-${props.issue.key}`} width={19} height={4} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? "#172554" : undefined} border={["left"]} borderColor={borderColor()} overflow="hidden">
      <text fg={props.selected ? theme.selectedText : theme.text} wrapMode="none">
        <span style={{ fg: typeColor() }}>■ </span>
        <span>{props.issue.key}</span>
      </text>
      <text fg={props.selected ? theme.selectedText : theme.textMuted} wrapMode="none">{props.issue.title}</text>
      <text fg={theme.textSubtle} wrapMode="none">
        {props.issue.type} · {props.issue.priority}{signal()}
      </text>
    </box>
  )
}

function Legend() {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={1}>
        <For each={configuredIssueTypes(state)}>
          {(issueType) => <text fg={theme.textSubtle} wrapMode="none"><span style={{ fg: issueType.color }}>■</span> {shortType(issueType.name)}</text>}
        </For>
      </box>
      <box flexDirection="row" gap={1}>
        <For each={configuredStatuses(state)}>
          {(status) => <text fg={status.color} wrapMode="none">● {shortStatus(status.name)}</text>}
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

function shortStatus(name: string) {
  if (name === "In Progress") return "Prog"
  if (name === "Code Review") return "Review"
  return name
}
