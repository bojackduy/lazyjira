import { TextAttributes, type KeyEvent } from "@opentui/core"
import { useRenderer, useTerminalDimensions } from "@opentui/solid"
import { For, onCleanup, onMount, Show, type JSX } from "solid-js"
import { useAppState } from "../context/app-state"
import { useConfig } from "../context/config"
import { useTheme } from "../context/theme"
import { useToast } from "../context/toast"
import { RouteSurface } from "../routes"
import { issueByKey } from "../state/issue-drafts"
import { routeLabel, sidebarRoutes } from "../state/routes"
import { stagedChanges, type StagedChange } from "../state/staged-changes"
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
        <Show when={state.route !== "workspace" && state.route !== "config"}>
          <IssueInspector compact={narrow()} />
        </Show>
      </box>
      <DeleteConfirm />
      <Footer />
      <StagedDiscardPopup />
      <RemoteApplyPopup />
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
      <text fg={theme.textMuted}>{footerText(state.focusedPane, state.route, state.stagedDiscardOpen, state.remoteApplyOpen)}</text>
      <text fg={theme.textSubtle}>{toast.message() ?? "demo scaffold"}</text>
    </box>
  )
}

function DeleteConfirm() {
  const { state } = useAppState()
  const theme = useTheme()
  const issue = () => state.pendingDeleteIssueKey ? state.issues[state.pendingDeleteIssueKey] : undefined

  return (
    <Show when={issue()}>
      {(selectedIssue) => (
        <box borderStyle="rounded" borderColor={theme.danger} paddingLeft={1} paddingRight={1} marginLeft={1} marginRight={1} flexDirection="row" justifyContent="space-between">
          <text fg={theme.danger} wrapMode="none">Delete {selectedIssue().key}: {selectedIssue().title}?</text>
          <text fg={theme.text} wrapMode="none">y stage delete · n/Esc cancel · w render · W write Jira</text>
        </box>
      )}
    </Show>
  )
}

function StagedDiscardPopup() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const changes = () => stagedChanges(state)
  useStagedDiscardKeyboard(appState)

  return (
    <Show when={state.stagedDiscardOpen}>
      <ModalFrame borderColor={theme.warning} width={84}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.warning}>Discard Staged Changes</text>
          <text fg={theme.textSubtle}>j/k choose · space mark · enter discard · esc/q close</text>
        </box>
        <Show when={changes().length} fallback={<text fg={theme.textMuted}>No staged changes to discard.</text>}>
          <For each={changes()}>
            {(change, index) => {
              const selected = () => state.stagedDiscardSelectedIndex === index()
              const checked = () => state.stagedDiscardSelections.includes(change.id)
              return (
                  <text fg={change.kind === "delete" ? theme.danger : selected() ? theme.selectedText : theme.text} bg={selected() ? theme.selected : undefined} wrapMode="none">
                    {selected() ? ">" : " "} [{checked() ? "x" : " "}] {stagedChangeText(change, change.kind === "config" ? undefined : issueByKey(state, change.issueKey)?.title)}
                </text>
              )
            }}
          </For>
        </Show>
      </ModalFrame>
    </Show>
  )
}

function RemoteApplyPopup() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const changes = () => stagedChanges(state)
  useRemoteApplyKeyboard(appState)

  return (
    <Show when={state.remoteApplyOpen}>
      <ModalFrame borderColor={theme.danger} width={86}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.danger}>Apply To Jira</text>
          <text fg={theme.textSubtle}>W final apply · esc/q cancel</text>
        </box>
        <text fg={theme.textMuted}>Review staged writes before the future Jira API call.</text>
        <Show when={changes().length} fallback={<text fg={theme.textMuted}>No staged writes. Edit a field and stage it before using W.</text>}>
          <For each={changes()}>
            {(change) => (
              <text fg={change.kind === "delete" ? theme.danger : change.kind === "config" ? theme.warning : theme.text} wrapMode="none">
                {change.kind === "delete" ? "-" : "~"} {stagedChangeText(change, change.kind === "config" ? undefined : issueByKey(state, change.issueKey)?.title)}
              </text>
            )}
          </For>
        </Show>
        <text fg={theme.warning} wrapMode="none">Jira API is not wired yet; confirming now keeps staged changes intact.</text>
      </ModalFrame>
    </Show>
  )
}

function useStagedDiscardKeyboard(appState: ReturnType<typeof useAppState>) {
  const renderer = useRenderer()
  onMount(() => {
    const handler = (event: KeyEvent) => {
      if (!appState.state.stagedDiscardOpen) return
      if (event.name === "return") {
        event.preventDefault()
        event.stopPropagation()
        appState.confirmStagedDiscard()
        return
      }
      if (event.name === "space") {
        event.preventDefault()
        event.stopPropagation()
        appState.toggleStagedDiscardSelection()
        return
      }
      if (event.name === "j" || event.name === "down") {
        event.preventDefault()
        event.stopPropagation()
        appState.moveStagedDiscardSelection(1)
        return
      }
      if (event.name === "k" || event.name === "up") {
        event.preventDefault()
        event.stopPropagation()
        appState.moveStagedDiscardSelection(-1)
        return
      }
      if (event.name === "escape" || event.name === "q") {
        event.preventDefault()
        event.stopPropagation()
        appState.closeStagedDiscard()
      }
    }
    renderer.keyInput.prependListener("keypress", handler)
    onCleanup(() => renderer.keyInput.off("keypress", handler))
  })
}

function useRemoteApplyKeyboard(appState: ReturnType<typeof useAppState>) {
  const renderer = useRenderer()
  onMount(() => {
    const handler = (event: KeyEvent) => {
      if (!appState.state.remoteApplyOpen) return
      if (event.name === "w" && event.shift) {
        event.preventDefault()
        event.stopPropagation()
        appState.confirmRemoteIssueApply()
        return
      }
      if (event.name === "escape" || event.name === "q") {
        event.preventDefault()
        event.stopPropagation()
        appState.closeRemoteIssueApply()
      }
    }
    renderer.keyInput.prependListener("keypress", handler)
    onCleanup(() => renderer.keyInput.off("keypress", handler))
  })
}

function ModalFrame(props: { borderColor: string; width: number; children: JSX.Element }) {
  const dimensions = useTerminalDimensions()
  const theme = useTheme()
  const width = () => Math.min(props.width, Math.max(40, dimensions().width - 4))
  const top = () => Math.max(1, Math.floor(dimensions().height * 0.2))

  return (
    <box
      position="absolute"
      zIndex={3000}
      left={0}
      top={0}
      width={dimensions().width}
      height={dimensions().height}
      alignItems="center"
      paddingTop={top()}
    >
      <box
        width={width()}
        borderStyle="rounded"
        borderColor={props.borderColor}
        backgroundColor={theme.panel}
        padding={1}
        flexDirection="column"
        gap={1}
      >
        {props.children}
      </box>
    </box>
  )
}

function stagedChangeText(change: StagedChange, issueTitle?: string) {
  if (change.kind === "config") return change.value
  if (change.kind === "delete") return `${change.issueKey} delete issue · ${issueTitle ?? "Unknown issue"}`
  const preview = change.value.replace(/\s+/g, " ").slice(0, 48)
  return `${change.issueKey} ${change.label} · ${preview}`
}

function footerText(focusedPane: string, route: string, stagedDiscardOpen: boolean, remoteApplyOpen: boolean) {
  if (remoteApplyOpen) return "remote write: W final apply placeholder  esc/q close"
  if (stagedDiscardOpen) return "discard staged: j/k choose  space mark  enter discard  esc/q close"
  if (focusedPane === "sidebar") return "sidebar: j/k choose  enter/l open/toggle  space filter  tab focus  q quit"
  if (focusedPane === "inspector") return "inspector: j/k field  e/enter edit  ctrl-enter stage  x delete  X discard  w render  W Jira"
  if (route === "issue-detail") return "detail: j/k line  d/u half-page  e edit body  ctrl-enter stage  X discard  w render  W Jira"
  if (route === "workspace") return "workspace: j/k choose  d/u page  enter open  X discard staged  W write Jira"
  if (route === "config") return "config: j/k choose  h/l pane  a add  e rename  c color  x remove  X discard  W Jira"
  if (route === "active-sprint") return "sprint: j/k card  h/l column  n new  x delete  enter detail  e inspector  W Jira"
  if (route === "kanban") return "kanban: j/k same status  h/l next cell  n new  x delete  g group  enter detail  W Jira"
  if (route === "backlog") return "backlog: j/k row  h/l group  n new  x delete  enter detail  e inspector  W Jira"
  return "1 workspace  2 sprint  3 backlog  4 kanban  n new  w render  W Jira  q quit"
}
