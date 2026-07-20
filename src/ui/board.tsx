import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { IssueSummary } from "../state/app-state"
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
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const groupBy = () => boardGroupByForMode(state, props.mode)
  const groups = () => boardGroupsForMode(state, props.mode)
  const visibleStatuses = () => visibleStatusesForBoard(state, props.mode, dimensions().width)
  const statusOffset = () => boardStatusOffsetForMode(state, props.mode)
  const statusWindowSize = () => boardStatusWindowSize(dimensions().width, state.statuses.length)
  const displayedStatusStart = () => Math.min(statusOffset(), Math.max(0, state.statuses.length - statusWindowSize())) + 1
  const bodyHeight = () => Math.max(6, dimensions().height - 15)
  const title = () => (props.mode === "active-sprint" ? `Active Sprint: ${activeSprint(state)?.name ?? "Sprint"}` : "Kanban Board")
  const subtitle = () =>
    props.mode === "active-sprint"
      ? (activeSprint(state)?.goal ?? "No sprint goal")
      : "Continuous-flow board using the same renderer with configurable grouping."

  useBindings(() => ({
    commands: [
      { name: `${props.mode}.page.down`, run: () => pageSelection(1) },
      { name: `${props.mode}.page.up`, run: () => pageSelection(-1) },
    ],
    bindings: [
      { key: "d", cmd: `${props.mode}.page.down` },
      { key: { name: "d", ctrl: true }, cmd: `${props.mode}.page.down` },
      { key: "u", cmd: `${props.mode}.page.up` },
      { key: { name: "u", ctrl: true }, cmd: `${props.mode}.page.up` },
    ],
  }))

  createEffect(() => {
    if (state.route !== props.mode) return
    scrollbox?.scrollChildIntoView(`issue-${state.selectedIssueKey}`)
  })

  function pageSelection(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== props.mode) return
    const keys = visibleIssueKeys()
    if (!keys.length) return
    const pageSize = Math.max(3, visibleStatuses().length * 2)
    const currentIndex = keys.indexOf(state.selectedIssueKey)
    const startIndex = currentIndex === -1 ? 0 : currentIndex
    const nextIndex = Math.max(0, Math.min(keys.length - 1, startIndex + delta * pageSize))
    appState.selectIssue(keys[nextIndex] ?? keys[0]!)
  }

  function visibleIssueKeys() {
    const visibleStatusIds = new Set(visibleStatuses().map((status) => status.id))
    const keys: string[] = []
    for (const group of groups()) {
      keys.push(...group.issueKeys.filter((issueKey) => visibleStatusIds.has(state.issues[issueKey]?.statusId ?? "")))
    }
    return keys
  }

  return (
    <box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <box flexDirection="row" justifyContent="space-between">
        <box flexDirection="column">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>{title()}</text>
          <text fg={theme.textMuted}>{subtitle()}</text>
        </box>
        <box flexDirection="column" alignItems="flex-end">
          <text fg={theme.text}>Group by: {groupModeLabel(groupBy())}</text>
          <text fg={theme.textSubtle}>Statuses {displayedStatusStart()}-{Math.min(displayedStatusStart() + visibleStatuses().length - 1, state.statuses.length)}/{state.statuses.length}</text>
        </box>
      </box>
      <Legend />
      <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} height={bodyHeight()} scrollY={true} viewportCulling={true}>
        <For each={groups()}>
          {(group) => (
            <box borderStyle="rounded" borderColor={theme.border} padding={1} flexDirection="column" gap={1} marginBottom={1} width="100%">
              <box flexDirection="row" justifyContent="space-between">
                <text attributes={TextAttributes.BOLD} fg={theme.text}>{group.label}</text>
                <text fg={theme.textSubtle}>{group.issueKeys.length} issues</text>
              </box>
              <box flexDirection="row" gap={1}>
                <For each={visibleStatuses()}>
                  {(status) => {
                    const issueKeys = () => group.issueKeys.filter((issueKey) => state.issues[issueKey]?.statusId === status.id)
                    return (
                      <box borderStyle="rounded" borderColor={status.color} padding={1} width={19} flexShrink={0}>
                        <text fg={status.color} wrapMode="none">{status.name}</text>
                        <For each={issueKeys()} fallback={<text fg={theme.textSubtle}>-</text>}>
                          {(issueKey) => {
                            const issue = state.issues[issueKey]
                            return issue ? <IssueCard issue={issue} selected={state.selectedIssueKey === issue.key} /> : null
                          }}
                        </For>
                      </box>
                    )
                  }}
                </For>
              </box>
            </box>
          )}
        </For>
      </scrollbox>
    </box>
  )
}

function IssueCard(props: { issue: IssueSummary; selected: boolean }) {
  const { state } = useAppState()
  const theme = useTheme()
  const typeColor = () => issueTypeColor(state, props.issue)
  const borderColor = () => (props.selected ? theme.borderActive : statusColor(state, props.issue))

  return (
    <box id={`issue-${props.issue.key}`} borderColor={borderColor()} paddingLeft={1} paddingRight={1} marginTop={1} backgroundColor={props.selected ? "#172554" : undefined}>
      <text fg={props.selected ? theme.selectedText : theme.text} wrapMode="none">
        <span style={{ fg: typeColor() }}>■ </span>
        <span>{props.issue.key}</span>
      </text>
      <text fg={props.selected ? theme.selectedText : theme.textMuted} wrapMode="none">{props.issue.title}</text>
      <text fg={theme.textSubtle} wrapMode="none">
        {props.issue.type} · {props.issue.priority}
      </text>
      <Show when={props.issue.blocked || props.issue.staleDays >= 7}>
        <text fg={props.issue.blocked ? theme.danger : theme.warning} wrapMode="none">
          {props.issue.blocked ? "blocked" : `stale ${props.issue.staleDays}d`}
        </text>
      </Show>
    </box>
  )
}

function Legend() {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={1}>
        <For each={state.issueTypes}>
          {(issueType) => <text fg={theme.textSubtle}><span style={{ fg: issueType.color }}>■</span> {issueType.name}</text>}
        </For>
      </box>
      <box flexDirection="row" gap={1}>
        <For each={state.statuses}>
          {(status) => <text fg={status.color}>● {status.name}</text>}
        </For>
      </box>
    </box>
  )
}
