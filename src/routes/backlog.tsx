import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { IssueSummary } from "../state/app-state"
import { groupBacklogIssues, groupModeLabel, issueTypeColor, statusColor, statusName } from "../state/selectors"

export function BacklogRoute() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const groups = () => groupBacklogIssues(state, state.backlogGroupBy)
  const compact = () => dimensions().width < 130
  const bodyHeight = () => Math.max(6, dimensions().height - 11)

  useBindings(() => ({
    commands: [
      { name: "backlog.page.down", run: () => pageSelection(1) },
      { name: "backlog.page.up", run: () => pageSelection(-1) },
    ],
    bindings: [
      { key: "d", cmd: "backlog.page.down" },
      { key: { name: "d", ctrl: true }, cmd: "backlog.page.down" },
      { key: "u", cmd: "backlog.page.up" },
      { key: { name: "u", ctrl: true }, cmd: "backlog.page.up" },
    ],
  }))

  createEffect(() => {
    if (state.route !== "backlog") return
    scrollbox?.scrollChildIntoView(`issue-${state.selectedIssueKey}`)
  })

  function pageSelection(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== "backlog") return
    const keys = groups().flatMap((group) => group.issueKeys)
    if (!keys.length) return
    const currentIndex = keys.indexOf(state.selectedIssueKey)
    const startIndex = currentIndex === -1 ? 0 : currentIndex
    const nextIndex = Math.max(0, Math.min(keys.length - 1, startIndex + delta * 8))
    appState.selectIssue(keys[nextIndex] ?? keys[0]!)
  }

  return (
    <box flexDirection="row" gap={1} flexGrow={1} minHeight={0}>
      <box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
        <box flexDirection={compact() ? "column" : "row"} justifyContent="space-between" gap={compact() ? 1 : 0}>
          <box flexDirection="column">
            <text attributes={TextAttributes.BOLD} fg={theme.accent}>Backlog: {state.board.name}</text>
            <text fg={theme.textMuted}>Default grouping is sprint, but mock grouping can cycle through Jira-like fields.</text>
          </box>
          <box alignItems={compact() ? "flex-start" : "flex-end"}>
            <text fg={theme.text}>Group by: {groupModeLabel(state.backlogGroupBy)}</text>
            <text fg={theme.textSubtle}>g group · h/l group jump</text>
          </box>
        </box>
        <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} height={bodyHeight()} scrollY={true} viewportCulling={true}>
          <For each={groups()}>
            {(group) => (
              <box borderStyle="rounded" borderColor={theme.border} padding={1} flexDirection="column" gap={1} marginBottom={1} width="100%">
                <box flexDirection="row" justifyContent="space-between">
                  <text attributes={TextAttributes.BOLD} fg={theme.text}>{group.label}</text>
                  <text fg={theme.textSubtle}>{sectionPoints(group.issueKeys)} pts · {group.issueKeys.length} issues</text>
                </box>
                <For each={group.issueKeys}>
                  {(issueKey) => {
                    const issue = state.issues[issueKey]
                    return issue ? <BacklogRow issue={issue} selected={state.selectedIssueKey === issue.key} compact={compact()} /> : null
                  }}
                </For>
              </box>
            )}
          </For>
        </scrollbox>
      </box>
      <Show when={!compact()}>
        <SprintHealth />
      </Show>
    </box>
  )

  function sectionPoints(issueKeys: string[]) {
    return issueKeys.reduce((total, issueKey) => total + (state.issues[issueKey]?.storyPoints ?? 0), 0)
  }
}

function BacklogRow(props: { issue: IssueSummary; selected: boolean; compact: boolean }) {
  const { state } = useAppState()
  const theme = useTheme()

  if (props.compact) {
    return (
      <box id={`issue-${props.issue.key}`} paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? "#172554" : undefined}>
        <text fg={props.selected ? theme.selectedText : theme.text} wrapMode="none">
          <span style={{ fg: issueTypeColor(state, props.issue) }}>■ </span>
          <span>{props.issue.key}</span>
          <span style={{ fg: theme.textSubtle }}> {props.issue.type}</span>
          <span> {props.issue.title}</span>
        </text>
        <text fg={statusColor(state, props.issue)} wrapMode="none">
          {statusName(state, props.issue)} · {props.issue.priority} · {props.issue.assignee} · {props.issue.storyPoints ?? "?"} pts
        </text>
      </box>
    )
  }

  return (
    <box
      id={`issue-${props.issue.key}`}
      flexDirection="row"
      justifyContent="space-between"
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={props.selected ? "#172554" : undefined}
    >
      <text fg={props.selected ? theme.selectedText : theme.text} wrapMode="none" width="60%">
        <span style={{ fg: issueTypeColor(state, props.issue) }}>■ </span>
        <span>{props.issue.key}</span>
        <span style={{ fg: theme.textSubtle }}> {props.issue.type}</span>
        <span> {props.issue.title}</span>
      </text>
      <text fg={statusColor(state, props.issue)} wrapMode="none" width="38%">
        {statusName(state, props.issue)} · {props.issue.priority} · {props.issue.assignee} · {props.issue.storyPoints ?? "?"} pts
      </text>
    </box>
  )
}

function SprintHealth() {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box borderStyle="rounded" borderColor={theme.border} padding={1} width={30} flexShrink={0}>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>Planning Signals</text>
      <text fg={theme.textMuted}>Todo: {state.stats.todo}</text>
      <text fg={theme.textMuted}>In progress/review: {state.stats.inProgress}</text>
      <text fg={theme.textMuted}>Done: {state.stats.done}</text>
      <text fg={theme.danger}>Blocked: {state.stats.blocked}</text>
      <text fg={theme.warning}>Stale &gt; 7d: {state.stats.stale}</text>
      <text fg={theme.warning}>Unassigned: {state.stats.unassigned}</text>
      <box paddingTop={1}>
        <text fg={theme.textSubtle}>Later this panel can read Jira sprint capacity, custom fields, and team-defined planning rules.</text>
      </box>
    </box>
  )
}
