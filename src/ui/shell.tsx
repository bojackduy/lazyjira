import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useConfig } from "../context/config"
import { useTheme } from "../context/theme"
import { useToast } from "../context/toast"
import { RouteSurface } from "../routes"
import { appRoutes, routeLabel } from "../state/routes"

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
  const { state, setRoute } = useAppState()
  const config = useConfig()
  const theme = useTheme()

  return (
    <box borderStyle="rounded" borderColor={theme.border} padding={1} width={26} flexShrink={0}>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>lazyjira-rs</text>
      <text fg={theme.textMuted}>{state.project.key} {state.project.name}</text>
      <text fg={theme.textSubtle}>{config.demoMode ? "demo mode" : "jira mode"}</text>
      <box paddingTop={1} flexDirection="column">
        <text fg={theme.warning}>Views</text>
        <For each={appRoutes}>
          {(route) => {
            const selected = () => state.route === route.id
            return (
              <text
                fg={selected() ? theme.selectedText : theme.textMuted}
                bg={selected() ? theme.selected : undefined}
                onMouseUp={() => setRoute(route.id)}
              >
                {selected() ? ">" : " "} {route.shortLabel}
              </text>
            )
          }}
        </For>
      </box>
      <box paddingTop={1} flexDirection="column">
        <text fg={theme.warning}>Quick Filters</text>
        <text fg={theme.textMuted}>&gt; Only My Issues</text>
        <text fg={theme.textMuted}>  Blocked</text>
        <text fg={theme.textMuted}>  Stale</text>
        <text fg={theme.textMuted}>  Unassigned</text>
      </box>
    </box>
  )
}

function MainSurface() {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box borderStyle="rounded" borderColor={theme.borderActive} padding={1} flexGrow={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>{routeLabel(state.route)}</text>
        <text fg={theme.textSubtle}>{state.board.name}</text>
      </box>
      <box paddingTop={1} flexGrow={1}>
        <RouteSurface />
      </box>
    </box>
  )
}

function Inspector(props: { compact: boolean }) {
  const { state } = useAppState()
  const theme = useTheme()
  const issue = () => state.issues[state.selectedIssueKey]

  return (
    <box borderStyle="rounded" borderColor={theme.border} padding={1} width={props.compact ? "100%" : 30} flexShrink={0}>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>Inspector</text>
      <Show when={issue()} fallback={<text fg={theme.textMuted}>No issue selected</text>}>
        {(selectedIssue) => (
          <box paddingTop={1} flexDirection="column" gap={1}>
            <text fg={theme.accent}>{selectedIssue().key}</text>
            <text fg={theme.text}>{selectedIssue().title}</text>
            <text fg={theme.textMuted}>{selectedIssue().type} - {selectedIssue().priority}</text>
            <text fg={theme.textMuted}>Status: {selectedIssue().status}</text>
            <text fg={theme.textMuted}>Assignee: {selectedIssue().assignee}</text>
            <text fg={selectedIssue().blocked ? theme.danger : theme.success}>
              {selectedIssue().blocked ? "Blocked" : "Not blocked"}
            </text>
          </box>
        )}
      </Show>
    </box>
  )
}

function Footer() {
  const theme = useTheme()
  const toast = useToast()

  return (
    <box height={1} paddingLeft={1} paddingRight={1} backgroundColor={theme.panel} flexDirection="row" justifyContent="space-between">
      <text fg={theme.textMuted}>? help  / search  tab focus  enter detail  q quit</text>
      <text fg={theme.textSubtle}>{toast.message() ?? "demo scaffold"}</text>
    </box>
  )
}
