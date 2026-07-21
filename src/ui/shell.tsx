import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { For } from "solid-js"
import { useAppState } from "../context/app-state"
import { useConfig } from "../context/config"
import { useTheme } from "../context/theme"
import { useToast } from "../context/toast"
import { RouteSurface } from "../routes"
import { routeLabel, sidebarRoutes } from "../state/routes"
import { IssueInspector } from "./issue-inspector"

export function AppShell() {
  const dimensions = useTerminalDimensions()
  const narrow = () => dimensions().width < 100
  const theme = useTheme()
  const { state } = useAppState()

  return (
    <box width="100%" height="100%" backgroundColor={theme.background} flexDirection="column">
      <box flexGrow={1} flexDirection={narrow() ? "column" : "row"} gap={1} padding={1}>
        <Sidebar />
        <MainSurface />
        <IssueInspector compact={narrow()} />
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
  if (focusedPane === "inspector") return "inspector: j/k field  e/enter edit  w apply staged  x discard  d/u scroll  tab focus"
  if (route === "issue-detail") return "detail: d/u scroll  e inspector  backspace/q back  tab focus"
  if (route === "active-sprint") return "sprint: j/k card  h/l column  n new  enter detail  e inspector  tab focus"
  if (route === "kanban") return "kanban: j/k same status  h/l status/next cell  n new  g group  enter detail"
  if (route === "backlog") return "backlog: j/k row  h/l group  n new  enter detail  e inspector  tab focus"
  return "1 workspace  2 sprint  3 backlog  4 kanban  n new  tab focus  q quit"
}
