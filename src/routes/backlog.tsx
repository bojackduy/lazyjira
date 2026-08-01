import { TextAttributes, type BoxRenderable, type ScrollBoxRenderable } from "@opentui/core"
import { onResize, useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, onCleanup, Show, type Accessor } from "solid-js"
import { useAppState } from "../context/app-state"
import { useIcons } from "../context/icons"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { IssueSummary } from "../state/app-state"
import { configuredIssueTypes, configuredStatuses } from "../state/config-drafts"
import { issueByKey } from "../state/issue-drafts"
import { backlogIssuePageSourceId, boardIssuePageSourceId, issuePageStatusText, sprintIssuePageSourceId } from "../state/issue-pages"
import { boardCapabilities } from "../state/routes"
import { routeBindingsBlocked } from "../state/keyboard-context"
import { emptyLoadedIssuesText, groupBacklogIssues, groupModeLabel, issueColor, issueTypeColor, issueTypeName, priorityColor, statusColor, statusName } from "../state/selectors"
import { ParentBadge } from "../ui/parent-badge"

export function BacklogRoute() {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let routeBox: BoxRenderable | undefined
  let scrollbox: ScrollBoxRenderable | undefined
  let measureTimer: ReturnType<typeof setTimeout> | undefined
  const [viewportWidth, setViewportWidth] = createSignal(estimatedBacklogViewportWidth(dimensions().width))
  const groups = () => groupBacklogIssues(state, state.backlogGroupBy)
  const capabilities = () => boardCapabilities(state.board)
  const layout = createMemo(() => backlogLayout(viewportWidth(), capabilities().supportsSprintBacklog))

  function scheduleViewportMeasure(terminalWidth: number) {
    const fallback = estimatedBacklogViewportWidth(terminalWidth)
    setViewportWidth(fallback)
    if (measureTimer) clearTimeout(measureTimer)
    // Let Yoga apply the fallback layout before reading the pane's actual width.
    measureTimer = setTimeout(() => {
      if (routeBox?.width) setViewportWidth(routeBox.width)
    }, 16)
  }

  createEffect(() => scheduleViewportMeasure(dimensions().width))
  onResize((width) => scheduleViewportMeasure(width))
  onCleanup(() => measureTimer && clearTimeout(measureTimer))

  useBindings(() => ({
    commands: [
      { name: "backlog.scroll.down", run: () => scrollPage(1) },
      { name: "backlog.scroll.up", run: () => scrollPage(-1) },
    ],
    bindings: state.route !== "backlog" || routeBindingsBlocked(state) ? [] : [
      { key: "d", cmd: "backlog.scroll.down" },
      { key: { name: "d", ctrl: true }, cmd: "backlog.scroll.down" },
      { key: "u", cmd: "backlog.scroll.up" },
      { key: { name: "u", ctrl: true }, cmd: "backlog.scroll.up" },
    ],
  }))

  createEffect(() => {
    if (state.route !== "backlog") return
    viewportWidth()
    const selectedGroup = groups().find((group) => group.id === state.selectedBacklogGroupId)
    scrollbox?.scrollChildIntoView(backlogScrollTarget(state.selectedBacklogGroupId, state.selectedIssueKey, state.collapsedBacklogGroupIds.includes(state.selectedBacklogGroupId), selectedGroup?.issueKeys ?? []))
  })

  function scrollPage(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== "backlog") return
    scrollbox?.scrollBy(delta, "viewport")
  }

  return (
    <box ref={(element: BoxRenderable) => (routeBox = element)} flexDirection="row" gap={1} flexGrow={1} minWidth={0} minHeight={0}>
      <box flexDirection="column" gap={1} flexGrow={1} minHeight={0} overflow="hidden">
        <box height={3} flexShrink={0} flexDirection="column">
          <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">Backlog: {state.board.name}</text>
          <text fg={theme.textMuted} wrapMode="none">
            {capabilities().supportsSprintBacklog ? `Sprint planning · grouped by ${groupModeLabel(state.backlogGroupBy)} · g cycle group` : "Kanban board backlog · no sprint controls"} · h/l jump group · Space collapse · L load more
          </text>
        </box>
        <BacklogLegend width={layout().rowWidth} />
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
              <box id={`backlog-group-${group.id}`} borderStyle="rounded" borderColor={state.selectedBacklogGroupId === group.id ? theme.borderActive : theme.border} backgroundColor={state.selectedBacklogGroupId === group.id ? theme.panel : undefined} padding={1} flexDirection="column" gap={0} marginBottom={1} width="100%">
                <box flexDirection="row" justifyContent="space-between">
                  <text attributes={TextAttributes.BOLD} fg={theme.text}>{state.collapsedBacklogGroupIds.includes(group.id) ? icons.catalog.structural.collapsed : icons.catalog.structural.expanded} {group.label}</text>
                  <text fg={theme.textSubtle}>{sectionPoints(group.issueKeys)} pts · {group.issueKeys.length} issues</text>
                </box>
                <Show when={!state.collapsedBacklogGroupIds.includes(group.id)}>
                  <For each={group.issueKeys}>
                    {(issueKey) => {
                      const issue = issueByKey(state, issueKey)
                      return issue ? <BacklogRow issue={issue} selected={state.selectedIssueKey === issue.key} layout={layout} /> : null
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
      <Show when={layout().showHealth}>
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
  const icons = useIcons()
  const issueTypeRows = () => packLegendRows(configuredIssueTypes(state).map((issueType) => ({ label: `${icons.issueType(issueType)} ${shortType(issueType.name)}`, color: issueType.color })), props.width, 1)
  const statusRows = () => packLegendRows(configuredStatuses(state).map((status) => ({ label: `${icons.status(status)} ${status.name}`, color: status.color })), props.width, 2)

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

export type BacklogRowMode = "wide" | "medium" | "narrow"

export type BacklogLayout = {
  mode: BacklogRowMode
  rowWidth: number
  showHealth: boolean
  showTypeName: boolean
  parentLabel: "key" | "key-title"
  showParent: boolean
  showPriorityLabel: boolean
  showPoints: boolean
  showAssignee: boolean
  showUnassignedIndicator: boolean
}

export function backlogLayout(viewportWidth: number, supportsSprintHealth: boolean): BacklogLayout {
  const width = Math.max(20, Math.floor(viewportWidth))
  const showHealth = supportsSprintHealth && width >= 145
  const rowWidth = Math.max(20, width - (showHealth ? 31 : 0))
  const mode: BacklogRowMode = rowWidth >= 110 ? "wide" : rowWidth >= 68 ? "medium" : "narrow"
  return {
    mode,
    rowWidth,
    showHealth,
    showTypeName: rowWidth >= 126,
    parentLabel: rowWidth >= 155 ? "key-title" : "key",
    showParent: rowWidth >= 68,
    showPriorityLabel: rowWidth >= 48,
    showPoints: rowWidth >= 58,
    showAssignee: rowWidth >= 92,
    showUnassignedIndicator: rowWidth >= 52,
  }
}

export function estimatedBacklogViewportWidth(terminalWidth: number) {
  return Math.max(20, terminalWidth < 100 ? terminalWidth - 8 : terminalWidth - 72)
}

export function backlogScrollTarget(groupId: string, selectedIssueKey: string, collapsed: boolean, issueKeys: string[]) {
  return !collapsed && issueKeys.includes(selectedIssueKey) ? `issue-${selectedIssueKey}` : `backlog-group-${groupId}`
}

function BacklogRow(props: { issue: IssueSummary; selected: boolean; layout: Accessor<BacklogLayout> }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const issueType = () => configuredIssueTypes(state).find((type) => type.id === props.issue.type || type.name === props.issue.type || type.name === props.issue.typeName)
  const typeIcon = () => icons.issueType({ name: issueTypeName(state, props.issue), subtask: issueType()?.subtask, hierarchyLevel: issueType()?.hierarchyLevel ?? props.issue.typeHierarchyLevel })

  return (
    <Show
      when={props.layout().mode === "wide"}
      fallback={(
        <box id={`issue-${props.issue.key}`} flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? "#172554" : undefined}>
          <IssueIdentity issue={props.issue} selected={props.selected} typeIcon={typeIcon()} showTypeName={false} fill />
          <BacklogMetadata issue={props.issue} layout={props.layout} />
        </box>
      )}
    >
      <box id={`issue-${props.issue.key}`} flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? "#172554" : undefined}>
        <box flexDirection="row" gap={1}>
          <IssueIdentity issue={props.issue} selected={props.selected} typeIcon={typeIcon()} showTypeName={props.layout().showTypeName} />
          <BacklogMetadata issue={props.issue} layout={props.layout} />
        </box>
      </box>
    </Show>
  )
}

function IssueIdentity(props: { issue: IssueSummary; selected: boolean; typeIcon: string; showTypeName: boolean; fill?: boolean }) {
  const { state } = useAppState()
  const theme = useTheme()
  return (
    <box flexDirection="row" flexGrow={props.fill ? 1 : 0} flexShrink={1} minWidth={0}>
      <text fg={props.selected ? theme.selectedText : theme.text} wrapMode="none" flexShrink={0}>
        <span style={{ fg: issueTypeColor(state, props.issue) }}>{props.typeIcon} </span>
        <span style={{ fg: issueColor(state, props.issue) }}>{props.issue.key}</span>
      </text>
      <Show when={props.showTypeName}>
        <text fg={theme.textSubtle} wrapMode="none" flexShrink={0}> {issueTypeName(state, props.issue)}</text>
      </Show>
      <text fg={props.selected ? theme.selectedText : theme.text} wrapMode="none" flexGrow={props.fill ? 1 : 0} flexShrink={1} minWidth={0}> {props.issue.title}</text>
    </box>
  )
}

function BacklogMetadata(props: { issue: IssueSummary; layout: Accessor<BacklogLayout> }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const status = () => configuredStatuses(state).find((candidate) => candidate.id === props.issue.statusId)
  const unassigned = () => props.issue.assignee === "Unassigned"
  const statusWidth = () => props.layout().mode === "narrow" ? Math.max(12, Math.min(24, props.layout().rowWidth - 12)) : 24

  return (
    <box flexDirection="row" gap={1} flexShrink={props.layout().mode === "wide" ? 0 : 1} minWidth={0}>
      <text fg={statusColor(state, props.issue)} wrapMode="none" maxWidth={statusWidth()} flexShrink={1} minWidth={8}>
        {icons.status(status() ?? { name: statusName(state, props.issue) })} {statusName(state, props.issue)}
      </text>
      <Show when={props.layout().showParent}>
        <ParentBadge issue={props.issue} maxWidth={props.layout().parentLabel === "key-title" ? 28 : 14} label={props.layout().parentLabel} flexShrink={1} topLevelOnly />
      </Show>
      <text fg={priorityColor(props.issue)} wrapMode="none" flexShrink={0}>
        {icons.priority(props.issue.priority)}{props.layout().showPriorityLabel ? ` ${props.issue.priority}` : ""}
      </text>
      <Show when={props.layout().showPoints}>
        <text fg={theme.textSubtle} wrapMode="none" flexShrink={0}>{props.issue.storyPoints ?? "?"} pts</text>
      </Show>
      <Show when={props.layout().showAssignee || (unassigned() && props.layout().showUnassignedIndicator)}>
        <text fg={unassigned() ? theme.warning : theme.textSubtle} wrapMode="none" maxWidth={16} flexShrink={1}>
          {unassigned() ? icons.catalog.exceptional.unassigned : ""}{props.layout().showAssignee ? `${unassigned() ? " " : ""}${props.issue.assignee}` : ""}
        </text>
      </Show>
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
