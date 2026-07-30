import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import { highestLevelIssueType, issueTypeColor, statusById } from "../state/selectors"
import {
  cycleTimelineZoom,
  formatTimelineDate,
  panTimelineWindow,
  projectTimelineRows,
  timelineCells,
  timelineCreateRowKey,
  timelineLayout,
  timelineModel,
  timelineNotices,
  timelineRowCopy,
  timelineSchedule,
  timelineSelection,
  timelineStateText,
  timelineTodayWindow,
  timelineWindowEnd,
  type TimelineCell,
  type TimelineProjectedRow,
} from "../state/timeline"

export function TimelineRoute() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const today = () => new Date().toISOString().slice(0, 10)
  const model = createMemo(() => timelineModel(state))
  const rows = createMemo(() => projectTimelineRows(model().rows, state.collapsedTimelineParentKeys))
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
    bindings: state.route !== "timeline" || state.searchOpen || state.inspectorEditingFieldId || state.commandPaletteOpen || state.helpOpen || state.projectPicker.open || state.remoteApplyOpen || state.stagedDiscardOpen || state.authOnboarding.open || state.commentEditing || state.detailBodyEditing ? [] : [
      { key: { name: "d", ctrl: true }, cmd: "timeline.page.down", preventDefault: false },
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
    appState.setTimelineSelection(timelineSelection(rows(), state.timelineSelectedIssueKey, delta * Math.max(1, Math.floor(visibleRows() / 2))))
  }

  function pan(units: number) {
    if (state.focusedPane !== "main" || state.route !== "timeline") return false
    appState.setTimelineWindowStart(panTimelineWindow(state.timelineWindowStart, state.timelineZoom, units))
  }

  function zoom() {
    if (state.focusedPane !== "main" || state.route !== "timeline") return false
    const nextZoom = cycleTimelineZoom(state.timelineZoom)
    appState.setTimelineZoom(nextZoom)
    appState.setTimelineWindowStart(timelineTodayWindow(state.timelineWindowStart, nextZoom))
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
        <text fg={theme.textMuted} wrapMode="none">j/k row · g/G ends · Ctrl-u/d half page · h/l pan · [/] viewport · Space collapse · z zoom · t today · Enter detail/create · L load more</text>
        <text fg={state.issuePageStateBySource["project-list"]?.error ? theme.danger : state.issuePageStateBySource["project-list"]?.loading ? theme.warning : theme.textSubtle} wrapMode="none">{timelineStateText(state, model())}</text>
        <For each={timelineNotices(model(), state.sprints)}>{(notice) => <text fg={theme.warning} wrapMode="none">{notice}</text>}</For>
      </box>

      <Show when={layout().wide} fallback={<NarrowTimeline rows={rows()} />}>
        <box flexDirection="column" flexGrow={1} minHeight={0} overflow="hidden">
          <TimelineGridHeader cells={cells()} identityWidth={layout().identityWidth} cellWidth={layout().cellWidth} />
          <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} flexGrow={1} minHeight={0} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }} verticalScrollbarOptions={{ visible: true, trackOptions: { backgroundColor: theme.panel, foregroundColor: theme.border } }}>
            <For each={rows()}>{(row, index) => <WideTimelineRow row={row} previousGroup={rows()[index() - 1]?.group} cells={cells()} identityWidth={layout().identityWidth} cellWidth={layout().cellWidth} />}</For>
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
      <For each={props.cells}>{(cell) => <text attributes={cell.today ? TextAttributes.BOLD : undefined} fg={cell.today ? theme.warning : theme.textSubtle} width={props.cellWidth} wrapMode="none">{fit(cell.today ? `|${cell.label}` : cell.label, props.cellWidth)}</text>}</For>
    </box>
  )
}

function WideTimelineRow(props: { row: TimelineProjectedRow; previousGroup?: TimelineProjectedRow["group"]; cells: TimelineCell[]; identityWidth: number; cellWidth: number }) {
  const { state } = useAppState()
  const theme = useTheme()
  const selected = () => state.timelineSelectedIssueKey === props.row.issue.key
  const sprint = () => state.sprints.find((candidate) => candidate.id === props.row.issue.sprintId)
  const schedule = () => timelineSchedule(props.row.issue, props.cells, sprint())
  const done = () => statusById(state, props.row.issue.statusId)?.category === "done"
  const scheduleColor = () => schedule().kind === "sprint" ? theme.textSubtle : props.row.issue.blocked ? theme.warning : done() ? theme.success : issueTypeColor(state, props.row.issue)

  return (
    <>
      <Show when={props.row.group !== "hierarchy" && props.row.group !== props.previousGroup}>
        <text attributes={TextAttributes.BOLD} fg={props.row.group === "missing-parent" ? theme.warning : theme.danger} marginTop={1}>{props.row.group === "missing-parent" ? "Parent not loaded" : "Invalid hierarchy"}</text>
      </Show>
      <box id={`timeline-${props.row.issue.key}`} height={1} flexShrink={0} flexDirection="row" backgroundColor={selected() && state.focusedPane === "main" ? theme.selected : undefined}>
        <text fg={selected() && state.focusedPane === "main" ? theme.selectedText : theme.text} width={props.identityWidth} wrapMode="none">
          <span>{selected() ? ">" : " "}</span>
          <span>{" ".repeat(props.row.depth * 2)}</span>
          <span style={{ fg: issueTypeColor(state, props.row.issue) }}>{disclosure(props.row)} </span>
          <span>{fit(`${props.row.issue.key} ${props.row.issue.title}`, Math.max(1, props.identityWidth - props.row.depth * 2 - 4))}</span>
        </text>
        <Show when={schedule().kind !== "text"} fallback={<text fg={scheduleColor()} wrapMode="none">{fit(timelineRowCopy(props.row, sprint()), props.cells.length * props.cellWidth)}</text>}>
          <For each={schedule().cells}>{(cell) => <text fg={scheduleColor()} width={props.cellWidth} wrapMode="none">{cell === "bar" ? "█".repeat(props.cellWidth) : cell === "sprint" ? "▒".repeat(props.cellWidth) : cell === "marker" ? fit("◆", props.cellWidth) : cell === "before" ? fit("<", props.cellWidth) : cell === "after" ? fit(">", props.cellWidth) : " ".repeat(props.cellWidth)}</text>}</For>
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
        <>
          <Show when={row.group !== "hierarchy" && row.group !== props.rows[index() - 1]?.group}>
            <text attributes={TextAttributes.BOLD} fg={row.group === "missing-parent" ? theme.warning : theme.danger} marginTop={1}>{row.group === "missing-parent" ? "Parent not loaded" : "Invalid hierarchy"}</text>
          </Show>
          <box id={`timeline-${row.issue.key}`} flexDirection="column" flexShrink={0} paddingLeft={1 + row.depth * 2} backgroundColor={state.timelineSelectedIssueKey === row.issue.key && state.focusedPane === "main" ? theme.selected : undefined}>
            <text fg={state.timelineSelectedIssueKey === row.issue.key && state.focusedPane === "main" ? theme.selectedText : theme.text} wrapMode="none">
              {state.timelineSelectedIssueKey === row.issue.key ? ">" : " "} <span style={{ fg: issueTypeColor(state, row.issue) }}>{disclosure(row)}</span> {row.issue.key} {row.issue.title}
            </text>
            <text fg={row.issue.blocked ? theme.warning : row.group === "invalid-hierarchy" ? theme.danger : theme.textMuted} wrapMode="none">  {timelineRowCopy(row, state.sprints.find((sprint) => sprint.id === row.issue.sprintId))}</text>
          </box>
        </>
      )}</For>
      <NarrowTimelineCreateRow />
    </scrollbox>
  )
}

function WideTimelineCreateRow(props: { identityWidth: number; scheduleWidth: number }) {
  const { state } = useAppState()
  const theme = useTheme()
  const selected = () => state.timelineSelectedIssueKey === timelineCreateRowKey
  const typeName = () => highestLevelIssueType(state)?.name.toLowerCase() ?? "issue"
  return <box id={`timeline-${timelineCreateRowKey}`} height={1} flexShrink={0} flexDirection="row" backgroundColor={selected() && state.focusedPane === "main" ? theme.selected : undefined}><text fg={selected() && state.focusedPane === "main" ? theme.selectedText : theme.textMuted} width={props.identityWidth} wrapMode="none">{fit(`${selected() ? ">" : " "} + New ${typeName()}`, props.identityWidth)}</text><text width={props.scheduleWidth}> </text></box>
}

function NarrowTimelineCreateRow() {
  const { state } = useAppState()
  const theme = useTheme()
  const selected = () => state.timelineSelectedIssueKey === timelineCreateRowKey
  const typeName = () => highestLevelIssueType(state)?.name.toLowerCase() ?? "issue"
  return <box id={`timeline-${timelineCreateRowKey}`} height={1} flexShrink={0} paddingLeft={1} backgroundColor={selected() && state.focusedPane === "main" ? theme.selected : undefined}><text fg={selected() && state.focusedPane === "main" ? theme.selectedText : theme.textMuted} wrapMode="none">{selected() ? ">" : " "} + New {typeName()}</text></box>
}

function disclosure(row: TimelineProjectedRow) {
  if (row.group === "missing-parent") return "?"
  if (row.group === "invalid-hierarchy") return "!"
  if (!row.hasChildren) return "·"
  return row.collapsed ? ">" : "v"
}

function fit(value: string, width: number) {
  const clipped = value.length > width ? `${value.slice(0, Math.max(0, width - 3))}...` : value
  return clipped.padEnd(width, " ")
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1)
}
