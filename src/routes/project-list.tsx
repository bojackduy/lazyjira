import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, onCleanup, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useIcons } from "../context/icons"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import { projectListCell, projectListColumns, projectListLoadMoreRowKey, projectListRows, projectListSelection, projectListSelectionKeys, projectListStateText, projectListViewportWidth, type ProjectListColumn } from "../state/project-list"
import { issuePageActionVisible, projectListIssuePageSourceId } from "../state/issue-pages"
import { issueColor, issueTypeColor, priorityColor, statusColor } from "../state/selectors"
import { halfViewportRows, routeBindingsBlocked } from "../state/keyboard-context"
import { LoadMoreActionRow, PartialResultsBanner } from "../ui/partial-results"

export function ProjectListRoute() {
  const appState = useAppState()
  const { state } = appState
  const icons = useIcons()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  let selectionScrollTimer: ReturnType<typeof setTimeout> | undefined
  const rows = () => projectListRows(state)
  const page = () => state.issuePageStateBySource[projectListIssuePageSourceId]
  const columns = () => projectListColumns(projectListViewportWidth(dimensions().width), state.projectListHorizontalOffset)
  const visibleRows = () => Math.max(1, dimensions().height - 13)

  useBindings(() => ({
    commands: [
      { name: "list.page.down", run: () => moveHalfPage(1) },
      { name: "list.page.up", run: () => moveHalfPage(-1) },
    ],
    bindings: state.route !== "list" || routeBindingsBlocked(state) ? [] : [
      { key: "d", cmd: "list.page.down", preventDefault: false },
      { key: { name: "d", ctrl: true }, cmd: "list.page.down", preventDefault: false },
      { key: "u", cmd: "list.page.up", preventDefault: false },
      { key: { name: "u", ctrl: true }, cmd: "list.page.up", preventDefault: false },
    ],
  }))

  createEffect(() => {
    if (state.route !== "list" || !state.projectListSelectedIssueKey) return
    if (selectionScrollTimer) clearTimeout(selectionScrollTimer)
    const targetId = `project-list-${state.projectListSelectedIssueKey}`
    selectionScrollTimer = setTimeout(() => scrollbox?.scrollChildIntoView(targetId), 16)
  })
  onCleanup(() => selectionScrollTimer && clearTimeout(selectionScrollTimer))

  function moveHalfPage(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== "list") return false
    const keys = projectListSelectionKeys(state)
    appState.setProjectListSelection(projectListSelection(keys, state.projectListSelectedIssueKey, delta * halfViewportRows(visibleRows())))
  }

  return (
    <box flexDirection="column" gap={1} flexGrow={1} minHeight={0} overflow="hidden">
      <box flexDirection="column" flexShrink={0}>
        <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">List · {state.project.key} · {state.projectListSort === "rank" ? "Rank asc" : "Updated desc"}</text>
        <text fg={theme.textMuted} wrapMode="none">j/k row · g/G ends · d/u or Ctrl-u/d half page · h/l columns · Space collapse · Enter detail · / filter · S Jira search · L load more · r refresh</text>
        <text fg={state.issuePageStateBySource["project-list"]?.error ? theme.danger : state.issuePageStateBySource["project-list"]?.loading ? theme.warning : theme.textSubtle} wrapMode="none">{projectListStateText(state)}</text>
        <PartialResultsBanner page={page()} />
      </box>

      <Show when={rows().length || issuePageActionVisible(page())} fallback={<ListEmptyState />}>
        <box flexDirection="column" flexGrow={1} minHeight={0} overflow="hidden">
          <ListRow columns={columns()} />
          <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} flexGrow={1} minHeight={0} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }} verticalScrollbarOptions={{ visible: true, trackOptions: { backgroundColor: theme.panel, foregroundColor: theme.border } }}>
            <For each={rows()}>
              {(row) => (
                <box id={`project-list-${row.issue.key}`} height={1} flexShrink={0} backgroundColor={state.projectListSelectedIssueKey === row.issue.key && state.focusedPane === "main" ? theme.selected : undefined}>
                  <text fg={state.projectListSelectedIssueKey === row.issue.key && state.focusedPane === "main" ? theme.selectedText : theme.text} wrapMode="none">
                    <span>{state.projectListSelectedIssueKey === row.issue.key ? icons.catalog.structural.selection : " "}</span>
                    <For each={columns()}>
                      {(column) => <span style={{ fg: column.id === "key" ? issueColor(state, row.issue) : column.id === "type" ? issueTypeColor(state, row.issue) : column.id === "status" ? statusColor(state, row.issue) : column.id === "priority" ? priorityColor(row.issue) : undefined }}>{formatCell(column.id === "summary" ? `${"  ".repeat(row.depth)}${row.hasChildren ? row.collapsed ? icons.catalog.structural.collapsed : icons.catalog.structural.expanded : icons.catalog.structural.leaf} ${row.issue.title}` : projectListCell(row.issue, column.id, state), column)}</span>}
                    </For>
                  </text>
                </box>
              )}
            </For>
            <LoadMoreActionRow page={page()} selected={state.projectListSelectedIssueKey === projectListLoadMoreRowKey && state.focusedPane === "main"} id={`project-list-${projectListLoadMoreRowKey}`} />
          </scrollbox>
        </box>
      </Show>
    </box>
  )
}

function ListRow(props: { columns: ProjectListColumn[] }) {
  const { theme } = useTheme()
  return <text attributes={TextAttributes.BOLD} fg={theme.warning} wrapMode="none"> {props.columns.map((column) => formatCell(column.label, column)).join("")}</text>
}

function ListEmptyState() {
  const { state } = useAppState()
  const { theme } = useTheme()
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center" flexDirection="column" gap={1}>
      <text fg={state.issuePageStateBySource["project-list"]?.error ? theme.danger : theme.textMuted}>{projectListStateText(state)}</text>
      <text fg={theme.textSubtle}>P switch project · q quit</text>
    </box>
  )
}

export function formatCell(value: string, column: ProjectListColumn) {
  const clipped = value.length > column.width - 1 ? `${value.slice(0, Math.max(0, column.width - 4))}...` : value
  return clipped.padEnd(column.width, " ")
}
