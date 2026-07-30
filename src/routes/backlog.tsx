import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { IssueSummary } from "../state/app-state"
import { configuredIssueTypes, configuredStatuses } from "../state/config-drafts"
import { issueByKey } from "../state/issue-drafts"
import { backlogIssuePageSourceId, boardIssuePageSourceId, issuePageStatusText, sprintIssuePageSourceId } from "../state/issue-pages"
import { boardCapabilities } from "../state/routes"
import { emptyLoadedIssuesText, groupBacklogIssues, groupModeLabel, issueTypeColor, issueTypeName, statusColor, statusName } from "../state/selectors"
import { ParentBadge } from "../ui/parent-badge"

export function BacklogRoute() {
  const { state } = useAppState()
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const groups = () => groupBacklogIssues(state, state.backlogGroupBy)
  const capabilities = () => boardCapabilities(state.board)
  const compact = () => backlogUsesCompactLayout(dimensions().width)
  const mainWidth = () => Math.max(20, dimensions().width - (compact() ? 8 : 38))

  useBindings(() => ({
    commands: [
      { name: "backlog.scroll.down", run: () => scrollPage(1) },
      { name: "backlog.scroll.up", run: () => scrollPage(-1) },
    ],
    bindings: state.searchOpen || state.inspectorEditingFieldId ? [] : [
      { key: "d", cmd: "backlog.scroll.down" },
      { key: { name: "d", ctrl: true }, cmd: "backlog.scroll.down" },
      { key: "u", cmd: "backlog.scroll.up" },
      { key: { name: "u", ctrl: true }, cmd: "backlog.scroll.up" },
    ],
  }))

  createEffect(() => {
    if (state.route !== "backlog") return
    const selectedGroup = groups().find((group) => group.id === state.selectedBacklogGroupId)
    scrollbox?.scrollChildIntoView(backlogScrollTarget(state.selectedBacklogGroupId, state.selectedIssueKey, state.collapsedBacklogGroupIds.includes(state.selectedBacklogGroupId), selectedGroup?.issueKeys ?? []))
  })

  function scrollPage(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== "backlog") return
    scrollbox?.scrollBy(delta, "viewport")
  }

  return (
    <box flexDirection="row" gap={1} flexGrow={1} minHeight={0}>
      <box flexDirection="column" gap={1} flexGrow={1} minHeight={0} overflow="hidden">
        <box height={3} flexShrink={0} flexDirection="column">
          <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">Backlog: {state.board.name}</text>
          <text fg={theme.textMuted} wrapMode="none">
            {capabilities().supportsSprintBacklog ? `Sprint planning · grouped by ${groupModeLabel(state.backlogGroupBy)} · g cycle group` : "Kanban board backlog · no sprint controls"} · h/l jump group · Space collapse · L load more
          </text>
        </box>
        <BacklogLegend width={mainWidth()} />
        <Show when={state.workspaceNotice}>
          {(notice) => <text fg={theme.warning} flexShrink={0} wrapMode="none">{notice()}</text>}
        </Show>
        <scrollbox
          ref={(element: ScrollBoxRenderable) => (scrollbox = element)}
          width="100%"
          flexBasis={0}
          flexGrow={1}
          flexShrink={1}
          minHeight={0}
          scrollY={true}
          viewportCulling={true}
          viewportOptions={{ paddingRight: 1 }}
          verticalScrollbarOptions={{ visible: true, trackOptions: { backgroundColor: theme.panel, foregroundColor: theme.border } }}
        >
          <For each={groups()}>
            {(group) => (
              <box id={`backlog-group-${group.id}`} borderStyle="rounded" borderColor={state.selectedBacklogGroupId === group.id ? theme.borderActive : theme.border} backgroundColor={state.selectedBacklogGroupId === group.id ? theme.panel : undefined} padding={1} flexDirection="column" gap={1} marginBottom={1} width="100%">
                <box flexDirection="row" justifyContent="space-between">
                  <text attributes={TextAttributes.BOLD} fg={theme.text}>{state.collapsedBacklogGroupIds.includes(group.id) ? ">" : "v"} {group.label}</text>
                  <text fg={theme.textSubtle}>{sectionPoints(group.issueKeys)} pts · {group.issueKeys.length} issues</text>
                </box>
                <Show when={!state.collapsedBacklogGroupIds.includes(group.id)}>
                  <For each={group.issueKeys}>
                    {(issueKey) => {
                      const issue = issueByKey(state, issueKey)
                      return issue ? <BacklogRow issue={issue} selected={state.selectedIssueKey === issue.key} compact={compact()} /> : null
                    }}
                  </For>
                  <Show when={!group.issueKeys.length}>
                    <text fg={theme.textMuted}>{emptyLoadedIssuesText(state, "backlog issues")} · Enter/n creates here.</text>
                  </Show>
                </Show>
                <Show when={capabilities().supportsSprintBacklog ? state.backlogGroupBy === "sprint" : true}>
                  <IssuePageLine sourceId={capabilities().supportsSprintBacklog ? backlogGroupSourceId(group.id) : boardIssuePageSourceId} />
                </Show>
              </box>
            )}
          </For>
        </scrollbox>
      </box>
      <Show when={!compact() && capabilities().supportsSprintBacklog}>
        <SprintHealth />
      </Show>
    </box>
  )

  function sectionPoints(issueKeys: string[]) {
    return issueKeys.reduce((total, issueKey) => total + (issueByKey(state, issueKey)?.storyPoints ?? 0), 0)
  }
}

function IssuePageLine(props: { sourceId: string }) {
  const { state } = useAppState()
  const theme = useTheme()
  const page = () => state.issuePageStateBySource[props.sourceId]

  return (
    <Show when={page()}>
      {(value) => (
        <text fg={value().error ? theme.danger : value().loading ? theme.warning : theme.textSubtle} wrapMode="none">
          {issuePageStatusText(value())}
        </text>
      )}
    </Show>
  )
}

function backlogGroupSourceId(groupId: string) {
  return groupId === "backlog" ? backlogIssuePageSourceId : sprintIssuePageSourceId(groupId)
}

function BacklogLegend(props: { width: number }) {
  const { state } = useAppState()
  const issueTypeRows = () => packLegendRows(configuredIssueTypes(state).map((issueType) => ({ label: `■ ${shortType(issueType.name)}`, color: issueType.color })), props.width, 1)
  const statusRows = () => packLegendRows(configuredStatuses(state).map((status) => ({ label: `● ${status.name}`, color: status.color })), props.width, 2)

  return (
    <box flexDirection="column" gap={0} flexShrink={0}>
      <For each={issueTypeRows().rows}>
        {(row) => <LegendRow tokens={row} overflow={0} />}
      </For>
      <For each={statusRows().rows}>
        {(row, index) => <LegendRow tokens={row} overflow={index() === statusRows().rows.length - 1 ? statusRows().overflow : 0} />}
      </For>
    </box>
  )
}

function LegendRow(props: { tokens: PackedLegendToken[]; overflow: number }) {
  const theme = useTheme()

  return (
    <text fg={theme.textSubtle} height={1} flexShrink={0} wrapMode="none">
      <For each={props.tokens}>
        {(token, index) => (
          <>
            <Show when={index() > 0}>{"  "}</Show>
            <span style={{ fg: token.color }}>{token.marker}</span> {token.text}
          </>
        )}
      </For>
      <Show when={props.overflow}>{"  +"}{props.overflow} more</Show>
    </text>
  )
}

export type LegendToken = {
  label: string
  color: string
}

type PackedLegendToken = LegendToken & { marker: string; text: string }

export function packLegendRows(tokens: LegendToken[], width: number, maxRows: number): { rows: PackedLegendToken[][]; overflow: number } {
  const normalized = tokens.map((token) => {
    const marker = token.label.slice(0, 1)
    const text = token.label.slice(1).trimStart()
    return { ...token, marker, text }
  })
  const rows: PackedLegendToken[][] = []
  const budget = Math.max(10, width)
  let used = 0

  for (const token of normalized) {
    const nextLength = token.label.length
    const separator = rows.at(-1)?.length ? 2 : 0
    if (!rows.length || used + separator + nextLength > budget) {
      if (rows.length >= maxRows) return { rows, overflow: normalized.length - rows.flat().length }
      rows.push([token])
      used = nextLength
      continue
    }

    rows[rows.length - 1]!.push(token)
    used += separator + nextLength
  }

  return { rows, overflow: 0 }
}

export function backlogUsesCompactLayout(width: number) {
  return width < 170
}

export function backlogScrollTarget(groupId: string, selectedIssueKey: string, collapsed: boolean, issueKeys: string[]) {
  return !collapsed && issueKeys.includes(selectedIssueKey) ? `issue-${selectedIssueKey}` : `backlog-group-${groupId}`
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
           <span style={{ fg: theme.textSubtle }}> {issueTypeName(state, props.issue)}</span>
          <span> {props.issue.title}</span>
        </text>
        <text fg={statusColor(state, props.issue)} wrapMode="none">
          {statusName(state, props.issue)} · {props.issue.priority} · {props.issue.assignee} · {props.issue.storyPoints ?? "?"} pts
        </text>
        <ParentBadge issue={props.issue} />
      </box>
    )
  }

  return (
    <box id={`issue-${props.issue.key}`} flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? "#172554" : undefined}>
      <box flexDirection="row" gap={1}>
        <text fg={props.selected ? theme.selectedText : theme.text} wrapMode="none" flexGrow={1} flexShrink={1} minWidth={0}>
          <span style={{ fg: issueTypeColor(state, props.issue) }}>■ </span>
          <span>{props.issue.key}</span>
          <span style={{ fg: theme.textSubtle }}> {issueTypeName(state, props.issue)}</span>
          <span> {props.issue.title}</span>
        </text>
        <box width={28} flexShrink={0}><ParentBadge issue={props.issue} width={28} /></box>
        <text fg={statusColor(state, props.issue)} wrapMode="none" width={34} flexShrink={0}>
          {statusName(state, props.issue)} · {props.issue.priority} · {props.issue.assignee} · {props.issue.storyPoints ?? "?"} pts
        </text>
      </box>
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

function shortType(name: string) {
  if (name === "Feature") return "Feat"
  if (name === "Subtask") return "Sub"
  return name
}
