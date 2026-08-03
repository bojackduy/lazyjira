import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { batch, createEffect, createMemo, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useIcons } from "../context/icons"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import { highestLevelIssueType, issueColor, statusById } from "../state/selectors"
import { halfViewportRows, routeBindingsBlocked } from "../state/keyboard-context"
import {
  cycleTimelineZoom,
  formatTimelineDate,
  panTimelineWindow,
  projectTimelineViewRows,
  timelineCells,
  timelineCreateRowKey,
  timelineLoadMoreRowKey,
  timelineLayout,
  timelineModel,
  timelineNotices,
  timelineRowCopy,
  timelineSchedule,
  timelineSelection,
  timelineStateText,
  timelineTodayWindow,
  timelineUnparentedSectionKey,
  timelineWindowEnd,
  zoomTimelineWindowStart,
  type TimelineCell,
  type TimelineProjectedIssueRow,
  type TimelineProjectedRow,
} from "../state/timeline"
import { issuePageActionVisible, projectListIssuePageSourceId } from "../state/issue-pages"
import { LoadMoreActionRow, PartialResultsBanner } from "../ui/partial-results"

export function TimelineRoute() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const today = () => new Date().toISOString().slice(0, 10)
  const model = createMemo(() => timelineModel(state))
  const rows = createMemo(() => projectTimelineViewRows(model().rows, state.collapsedTimelineParentKeys))
  const page = () => state.issuePageStateBySource[projectListIssuePageSourceId]
  const layout = createMemo(() => timelineLayout(dimensions().width, state.timelineZoom))
  const cells = createMemo(() => timelineCells(state.timelineWindowStart, state.timelineZoom, layout().cellCount, today()))
  const visibleRows = () => Math.max(1, dimensions().height - 14)

  useBindings(() => ({
    commands: [
      { name: "timeline.page.down", run: () => moveHalfPage(1) },
      { name: "timeline.page.up", run: () => moveHalfPage(-1) },
      { name: "timeline.pan.previous-viewport", run: () => pan(-layout().cellCount) },
      { name: "timeline.pan.next-viewport", run: () => pan(layout().cellCount) },
      { name: "timeline.zoom", run: () => zoom() },
      { name: "timeline.today", run: () => returnToToday() },
    ],
    bindings: state.route !== "timeline" || routeBindingsBlocked(state) ? [] : [
      { key: "d", cmd: "timeline.page.down", preventDefault: false },
      { key: { name: "d", ctrl: true }, cmd: "timeline.page.down", preventDefault: false },
      { key: "u", cmd: "timeline.page.up", preventDefault: false },
      { key: { name: "u", ctrl: true }, cmd: "timeline.page.up", preventDefault: false },
      { key: "[", cmd: "timeline.pan.previous-viewport", preventDefault: false },
      { key: "]", cmd: "timeline.pan.next-viewport", preventDefault: false },
      { key: "z", cmd: "timeline.zoom", preventDefault: false },
      { key: "t", cmd: "timeline.today", preventDefault: false },
    ],
  }))

  createEffect(() => {
    if (state.route !== "timeline" || !state.timelineSelectedIssueKey) return
    scrollbox?.scrollChildIntoView(`timeline-${state.timelineSelectedIssueKey}`)
  })

  function moveHalfPage(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== "timeline") return false
    appState.setTimelineSelection(timelineSelection(rows(), state.timelineSelectedIssueKey, delta * halfViewportRows(visibleRows()), issuePageActionVisible(page())))
  }

  function pan(units: number) {
    if (state.focusedPane !== "main" || state.route !== "timeline") return false
    appState.setTimelineWindowStart(panTimelineWindow(state.timelineWindowStart, state.timelineZoom, units))
  }

  function zoom() {
    if (state.focusedPane !== "main" || state.route !== "timeline") return false
    const nextZoom = cycleTimelineZoom(state.timelineZoom)
    const nextWindowStart = zoomTimelineWindowStart(state.timelineWindowStart, state.timelineZoom, layout().cellCount, nextZoom)
    batch(() => {
      appState.setTimelineZoom(nextZoom)
      appState.setTimelineWindowStart(nextWindowStart)
    })
  }

  function returnToToday() {
    if (state.focusedPane !== "main" || state.route !== "timeline") return false
    appState.setTimelineWindowStart(timelineTodayWindow(today(), state.timelineZoom))
  }

  return (
    <box flexDirection="column" gap={1} flexGrow={1} minHeight={0} overflow="hidden">
      <box flexDirection="column" flexShrink={0}>
        <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">
          Timeline · {state.project.key} {state.project.name} · {formatTimelineDate(cells()[0]?.start ?? state.timelineWindowStart)}-{formatTimelineDate(timelineWindowEnd(state.timelineWindowStart, state.timelineZoom, layout().cellCount))} · {capitalize(state.timelineZoom)}
        </text>
        <text fg={theme.textMuted} wrapMode="none">j/k row · g/G ends · d/u or Ctrl-u/d half page · h/l pan · [/] viewport · Space collapse/section · z zoom · t today · Enter open/toggle/create · L load more</text>
        <text fg={state.issuePageStateBySource["project-list"]?.error ? theme.danger : state.issuePageStateBySource["project-list"]?.loading ? theme.warning : theme.textSubtle} wrapMode="none">{timelineStateText(state, model())}</text>
        <PartialResultsBanner page={page()} />
        <For each={timelineNotices(model(), state.sprints)}>{(notice) => <text fg={theme.warning} wrapMode="none">{notice}</text>}</For>
      </box>

      <Show when={layout().wide} fallback={<NarrowTimeline rows={rows()} />}>
        <box flexDirection="column" flexGrow={1} minHeight={0} overflow="hidden">
          <TimelineGridHeader cells={cells()} identityWidth={layout().identityWidth} cellWidth={layout().cellWidth} />
          <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} flexGrow={1} minHeight={0} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }} verticalScrollbarOptions={{ visible: true, trackOptions: { backgroundColor: theme.panel, foregroundColor: theme.border } }}>
            <For each={rows()}>{(row, index) => <WideTimelineProjectedRow row={row} previousGroup={rows()[index() - 1]?.group} cells={cells()} identityWidth={layout().identityWidth} cellWidth={layout().cellWidth} />}</For>
            <LoadMoreActionRow page={page()} selected={state.timelineSelectedIssueKey === timelineLoadMoreRowKey && state.focusedPane === "main"} id={`timeline-${timelineLoadMoreRowKey}`} />
            <WideTimelineCreateRow identityWidth={layout().identityWidth} scheduleWidth={cells().length * layout().cellWidth} />
          </scrollbox>
        </box>
      </Show>
    </box>
  )
}

function TimelineGridHeader(props: { cells: TimelineCell[]; identityWidth: number; cellWidth: number }) {
  const theme = useTheme()
  return (
    <box flexDirection="row" flexShrink={0}>
      <text attributes={TextAttributes.BOLD} fg={theme.warning} width={props.identityWidth} wrapMode="none"> Work</text>
      <For each={props.cells}>{(cell) => <text attributes={cell.today ? TextAttributes.BOLD : undefined} fg={cell.today ? theme.warning : theme.textSubtle} width={props.cellWidth} wrapMode="none">{fit(`${cell.today ? "|" : " "}${cell.label}`, props.cellWidth)}</text>}</For>
    </box>
  )
}

function WideTimelineProjectedRow(props: { row: TimelineProjectedRow; previousGroup?: TimelineProjectedRow["group"]; cells: TimelineCell[]; identityWidth: number; cellWidth: number }) {
  return props.row.kind === "section"
    ? <WideTimelineSectionRow row={props.row} identityWidth={props.identityWidth} scheduleWidth={props.cells.length * props.cellWidth} />
    : <WideTimelineIssueRow row={props.row} previousGroup={props.previousGroup} cells={props.cells} identityWidth={props.identityWidth} cellWidth={props.cellWidth} />
}

function WideTimelineSectionRow(props: { row: Extract<TimelineProjectedRow, { kind: "section" }>; identityWidth: number; scheduleWidth: number }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const selected = () => state.timelineSelectedIssueKey === timelineUnparentedSectionKey
  return (
    <box id={`timeline-${timelineUnparentedSectionKey}`} height={1} flexShrink={0} flexDirection="row" marginTop={1} backgroundColor={selected() && state.focusedPane === "main" ? theme.selected : undefined}>
      <text attributes={TextAttributes.BOLD} fg={selected() && state.focusedPane === "main" ? theme.selectedText : theme.warning} width={props.identityWidth} wrapMode="none">{fit(`${selected() ? icons.catalog.structural.selection : " "} ${props.row.collapsed ? icons.catalog.structural.collapsed : icons.catalog.structural.expanded} ${props.row.label} (${props.row.issueCount})`, props.identityWidth)}</text>
      <text fg={theme.textMuted} width={props.scheduleWidth} wrapMode="none">{fit(props.row.collapsed ? "Space/Enter to expand" : "Space/Enter to collapse", props.scheduleWidth)}</text>
    </box>
  )
}

function WideTimelineIssueRow(props: { row: TimelineProjectedIssueRow; previousGroup?: TimelineProjectedRow["group"]; cells: TimelineCell[]; identityWidth: number; cellWidth: number }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const selected = () => state.timelineSelectedIssueKey === props.row.issue.key
  const sprint = () => state.sprints.find((candidate) => candidate.id === props.row.issue.sprintId)
  const schedule = () => timelineSchedule(props.row.issue, props.cells, sprint())
  const done = () => statusById(state, props.row.issue.statusId)?.category === "done"
  const scheduleColor = () => props.row.issue.blocked ? theme.warning : done() ? theme.success : issueColor(state, props.row.issue)

  return (
    <>
      <Show when={props.row.group === "invalid-hierarchy" && props.row.group !== props.previousGroup}>
        <text attributes={TextAttributes.BOLD} fg={theme.danger} marginTop={1}>{icons.catalog.structural.invalidHierarchy} Invalid hierarchy</text>
      </Show>
      <box id={`timeline-${props.row.issue.key}`} height={1} flexShrink={0} flexDirection="row" backgroundColor={selected() && state.focusedPane === "main" ? theme.selected : undefined}>
        <text fg={selected() && state.focusedPane === "main" ? theme.selectedText : theme.text} width={props.identityWidth} wrapMode="none">
          <span>{selected() ? icons.catalog.structural.selection : " "}</span>
          <span>{" ".repeat(props.row.depth * 2)}</span>
          <span style={{ fg: issueColor(state, props.row.issue) }}>{disclosure(props.row, icons.catalog.structural)} </span>
          <span>{fit(`${props.row.issue.key} ${props.row.issue.title}`, Math.max(1, props.identityWidth - props.row.depth * 2 - 4))}</span>
        </text>
        <Show when={schedule().kind !== "text"} fallback={<text fg={scheduleColor()} wrapMode="none">{fit(timelineRowCopy(props.row, sprint()), props.cells.length * props.cellWidth)}</text>}>
          <For each={schedule().cells}>{(cell) => <text fg={scheduleColor()} width={props.cellWidth} wrapMode="none">{cell === "bar" ? "━".repeat(props.cellWidth) : cell === "sprint" ? "┄".repeat(props.cellWidth) : cell === "marker" ? fit("◆", props.cellWidth) : cell === "before" ? fit("<", props.cellWidth) : cell === "after" ? fit(">", props.cellWidth) : " ".repeat(props.cellWidth)}</text>}</For>
        </Show>
      </box>
    </>
  )
}

function NarrowTimeline(props: { rows: TimelineProjectedRow[] }) {
  const { state } = useAppState()
  const theme = useTheme()
  let scrollbox: ScrollBoxRenderable | undefined

  createEffect(() => {
    if (state.route === "timeline" && state.timelineSelectedIssueKey) scrollbox?.scrollChildIntoView(`timeline-${state.timelineSelectedIssueKey}`)
  })

  return (
    <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} flexGrow={1} minHeight={0} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }} verticalScrollbarOptions={{ visible: true, trackOptions: { backgroundColor: theme.panel, foregroundColor: theme.border } }}>
      <For each={props.rows}>{(row, index) => (
        <NarrowTimelineProjectedRow row={row} previousGroup={props.rows[index() - 1]?.group} />
      )}</For>
      <LoadMoreActionRow page={state.issuePageStateBySource[projectListIssuePageSourceId]} selected={state.timelineSelectedIssueKey === timelineLoadMoreRowKey && state.focusedPane === "main"} id={`timeline-${timelineLoadMoreRowKey}`} />
      <NarrowTimelineCreateRow />
    </scrollbox>
  )
}

function NarrowTimelineProjectedRow(props: { row: TimelineProjectedRow; previousGroup?: TimelineProjectedRow["group"] }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  if (props.row.kind === "section") {
    const selected = () => state.timelineSelectedIssueKey === timelineUnparentedSectionKey
    return <box id={`timeline-${timelineUnparentedSectionKey}`} height={1} flexShrink={0} paddingLeft={1} marginTop={1} backgroundColor={selected() && state.focusedPane === "main" ? theme.selected : undefined}><text attributes={TextAttributes.BOLD} fg={selected() && state.focusedPane === "main" ? theme.selectedText : theme.warning} wrapMode="none">{selected() ? icons.catalog.structural.selection : " "} {props.row.collapsed ? icons.catalog.structural.collapsed : icons.catalog.structural.expanded} {props.row.label} ({props.row.issueCount})</text></box>
  }
  return (
    <>
      <Show when={props.row.group === "invalid-hierarchy" && props.row.group !== props.previousGroup}>
        <text attributes={TextAttributes.BOLD} fg={theme.danger} marginTop={1}>{icons.catalog.structural.invalidHierarchy} Invalid hierarchy</text>
      </Show>
      <box id={`timeline-${props.row.issue.key}`} flexDirection="column" flexShrink={0} paddingLeft={1 + props.row.depth * 2} backgroundColor={state.timelineSelectedIssueKey === props.row.issue.key && state.focusedPane === "main" ? theme.selected : undefined}>
        <text fg={state.timelineSelectedIssueKey === props.row.issue.key && state.focusedPane === "main" ? theme.selectedText : theme.text} wrapMode="none">
          {state.timelineSelectedIssueKey === props.row.issue.key ? icons.catalog.structural.selection : " "} <span style={{ fg: issueColor(state, props.row.issue) }}>{disclosure(props.row, icons.catalog.structural)}</span> {props.row.issue.key} {props.row.issue.title}
        </text>
        <NarrowTimelineSchedule row={props.row} />
      </box>
    </>
  )
}

function NarrowTimelineSchedule(props: { row: TimelineProjectedIssueRow }) {
  const { state } = useAppState()
  const theme = useTheme()
  const sprint = () => state.sprints.find((candidate) => candidate.id === props.row.issue.sprintId)
  const schedule = () => timelineSchedule(props.row.issue, [], sprint())
  const done = () => statusById(state, props.row.issue.statusId)?.category === "done"
  const color = () => props.row.group === "invalid-hierarchy" ? theme.danger : props.row.issue.blocked ? theme.warning : done() ? theme.success : issueColor(state, props.row.issue)
  const marker = () => schedule().kind === "bar" ? "━━" : schedule().kind === "sprint" ? "┄┄" : schedule().kind === "marker" ? "◆" : "·"
  return <text fg={schedule().kind === "text" ? theme.textMuted : color()} wrapMode="none">  {marker()} {timelineRowCopy(props.row, sprint())}</text>
}

function WideTimelineCreateRow(props: { identityWidth: number; scheduleWidth: number }) {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const selected = () => state.timelineSelectedIssueKey === timelineCreateRowKey
  const typeName = () => highestLevelIssueType(state)?.name.toLowerCase() ?? "issue"
  return <box id={`timeline-${timelineCreateRowKey}`} height={1} flexShrink={0} flexDirection="row" backgroundColor={selected() && state.focusedPane === "main" ? theme.selected : undefined}><text fg={selected() && state.focusedPane === "main" ? theme.selectedText : theme.textMuted} width={props.identityWidth} wrapMode="none">{fit(`${selected() ? icons.catalog.structural.selection : " "} ${icons.catalog.structural.create} New ${typeName()}`, props.identityWidth)}</text><text width={props.scheduleWidth}> </text></box>
}

function NarrowTimelineCreateRow() {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()
  const selected = () => state.timelineSelectedIssueKey === timelineCreateRowKey
  const typeName = () => highestLevelIssueType(state)?.name.toLowerCase() ?? "issue"
  return <box id={`timeline-${timelineCreateRowKey}`} height={1} flexShrink={0} paddingLeft={1} backgroundColor={selected() && state.focusedPane === "main" ? theme.selected : undefined}><text fg={selected() && state.focusedPane === "main" ? theme.selectedText : theme.textMuted} wrapMode="none">{selected() ? icons.catalog.structural.selection : " "} {icons.catalog.structural.create} New {typeName()}</text></box>
}

function disclosure(row: TimelineProjectedIssueRow, icons: ReturnType<typeof useIcons>["catalog"]["structural"]) {
  if (row.classification === "missing-parent") return icons.missingParent
  if (row.group === "invalid-hierarchy") return icons.invalidHierarchy
  if (!row.hasChildren) return icons.leaf
  return row.collapsed ? icons.collapsed : icons.expanded
}

function fit(value: string, width: number) {
  const clipped = value.length > width ? `${value.slice(0, Math.max(0, width - 3))}...` : value
  return clipped.padEnd(width, " ")
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}
