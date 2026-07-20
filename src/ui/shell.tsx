import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useConfig } from "../context/config"
import { useTheme } from "../context/theme"
import { useToast } from "../context/toast"
import { RouteSurface } from "../routes"
import { routeLabel, sidebarRoutes } from "../state/routes"
import { issueTypeColor, statusColor, statusName } from "../state/selectors"

export function AppShell() {
  const dimensions = useTerminalDimensions()
  const narrow = () => dimensions().width < 100
  const theme = useTheme()

  return (
    <box width="100%" height="100%" backgroundColor={theme.background} flexDirection="column">
      <box flexGrow={1} flexDirection={narrow() ? "column" : "row"} gap={1} padding={1}>
        <Sidebar />
        <MainSurface />
        <Inspector compact={narrow()} />
      </box>
      <Footer />
    </box>
  )
}

function Sidebar() {
  const { state, setFocusedPane, setRoute, toggleQuickFilter } = useAppState()
  const config = useConfig()
  const theme = useTheme()
  const focused = () => state.focusedPane === "sidebar"

  return (
    <box borderStyle="rounded" borderColor={focused() ? theme.borderActive : theme.border} padding={1} width={26} flexShrink={0} onMouseUp={() => setFocusedPane("sidebar")}>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>lazyjira-rs</text>
      <text fg={theme.textMuted}>{state.project.key} {state.project.name}</text>
      <text fg={theme.textSubtle}>{config.demoMode ? "mock data" : "jira mode"}</text>
      <box paddingTop={1} flexDirection="column">
        <text fg={theme.warning}>Views</text>
        <For each={sidebarRoutes}>
          {(route, index) => {
            const selected = () => state.sidebarSelectedIndex === index()
            const current = () => state.route === route.id
            return (
              <text
                fg={selected() ? theme.selectedText : current() ? theme.text : theme.textMuted}
                bg={selected() && focused() ? theme.selected : undefined}
                onMouseUp={() => {
                  setFocusedPane("sidebar")
                  setRoute(route.id)
                }}
              >
                {selected() ? ">" : current() ? "*" : " "} {route.shortLabel}
              </text>
            )
          }}
        </For>
      </box>
      <box paddingTop={1} flexDirection="column">
        <text fg={theme.warning}>Quick Filters</text>
        <For each={state.quickFilters}>
          {(filter, index) => {
            const sidebarIndex = () => sidebarRoutes.length + index()
            const selected = () => state.sidebarSelectedIndex === sidebarIndex()
            const active = () => state.activeQuickFilters.includes(filter.id)
            return (
              <text
                fg={selected() ? theme.selectedText : active() ? theme.text : theme.textMuted}
                bg={selected() && focused() ? theme.selected : undefined}
                onMouseUp={() => {
                  setFocusedPane("sidebar")
                  toggleQuickFilter(filter.id)
                }}
              >
                {selected() ? ">" : " "} [{active() ? "x" : " "}] {filter.label}
              </text>
            )
          }}
        </For>
      </box>
    </box>
  )
}

function MainSurface() {
  const { state, setFocusedPane } = useAppState()
  const theme = useTheme()
  const focused = () => state.focusedPane === "main"

  return (
    <box borderStyle="rounded" borderColor={focused() ? theme.borderActive : theme.border} padding={1} flexGrow={1} flexShrink={1} minWidth={0} minHeight={0} onMouseUp={() => setFocusedPane("main")}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>{routeLabel(state.route)}</text>
        <text fg={theme.textSubtle}>{state.board.name}</text>
      </box>
      <box paddingTop={1} flexGrow={1} minHeight={0}>
        <RouteSurface />
      </box>
    </box>
  )
}

function Inspector(props: { compact: boolean }) {
  const { state, setFocusedPane } = useAppState()
  const theme = useTheme()
  const issue = () => state.issues[state.selectedIssueKey]
  const focused = () => state.focusedPane === "inspector"

  return (
    <box borderStyle="rounded" borderColor={focused() ? theme.borderActive : theme.border} padding={1} width={props.compact ? "100%" : 30} flexShrink={0} onMouseUp={() => setFocusedPane("inspector")}>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>Inspector</text>
      <Show when={issue()} fallback={<text fg={theme.textMuted}>No issue selected</text>}>
        {(selectedIssue) => (
          <box paddingTop={1} flexDirection="column" gap={1}>
            <text fg={theme.accent}>{selectedIssue().key}</text>
            <text fg={theme.text}>{selectedIssue().title}</text>
            <text fg={issueTypeColor(state, selectedIssue())}>■ {selectedIssue().type} - {selectedIssue().priority}</text>
            <text fg={statusColor(state, selectedIssue())}>● {statusName(state, selectedIssue())}</text>
            <text fg={theme.textMuted}>Assignee: {selectedIssue().assignee}</text>
            <text fg={theme.textMuted}>Feature: {selectedIssue().feature ?? "None"}</text>
            <text fg={theme.textMuted}>Space: {selectedIssue().space ?? "None"}</text>
            <text fg={selectedIssue().blocked ? theme.danger : theme.success}>
              {selectedIssue().blocked ? "Blocked" : "Not blocked"}
            </text>
            <text fg={selectedIssue().staleDays >= 7 ? theme.warning : theme.textSubtle}>Stale: {selectedIssue().staleDays}d</text>
          </box>
        )}
      </Show>
    </box>
  )
}

function Footer() {
  const { state } = useAppState()
  const theme = useTheme()
  const toast = useToast()

  return (
    <box height={1} paddingLeft={1} paddingRight={1} backgroundColor={theme.panel} flexDirection="row" justifyContent="space-between">
      <text fg={theme.textMuted}>{footerText(state.focusedPane, state.route)}</text>
      <text fg={theme.textSubtle}>{toast.message() ?? "demo scaffold"}</text>
    </box>
  )
}

function footerText(focusedPane: string, route: string) {
  if (focusedPane === "sidebar") return "sidebar: j/k choose  enter/l open/toggle  space filter  tab focus  q quit"
  if (route === "active-sprint" || route === "kanban") return "board: j/k card  h/l status  u/d page  g group  enter detail  tab focus  q quit"
  if (route === "backlog") return "backlog: j/k row  h/l group  u/d page  g group  enter detail  tab focus  q quit"
  if (route === "issue-detail") return "detail: u/d scroll  backspace/q back  tab focus"
  return "1 workspace  2 sprint  3 backlog  4 kanban  tab focus  q quit"
}
