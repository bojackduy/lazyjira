import { TextAttributes, type InputRenderable, type KeyEvent } from "@opentui/core"
import { useRenderer, useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, onCleanup, onMount, Show, type JSX } from "solid-js"
import { useAppState } from "../context/app-state"
import { useConfig } from "../context/config"
import { useTheme } from "../context/theme"
import { useToast } from "../context/toast"
import { RouteSurface } from "../routes"
import { issueByKey } from "../state/issue-drafts"
import type { AppState } from "../state/app-state"
import { routeLabel, sidebarRoutes } from "../state/routes"
import { allIssues, issueList } from "../state/selectors"
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
      <AuthOnboardingPopup />
      <ProjectPickerPopup />
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
        <text attributes={TextAttributes.BOLD} fg={theme.text}>{config.appName}</text>
        <text fg={theme.textMuted}>{state.project.key} {state.project.name}</text>
        <text fg={theme.textSubtle}>{runtimeModeText(config, state.jiraAuthReady, state.jiraProjectReady)}</text>
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
      <box paddingTop={1} flexDirection="column" flexGrow={1} minHeight={0}>
        <SearchBar />
        <box paddingTop={state.route !== "config" && (state.searchOpen || state.searchQuery) ? 1 : 0} flexGrow={1} minHeight={0}>
          <RouteSurface />
        </box>
      </box>
    </box>
  )
}

function SearchBar() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  let input: InputRenderable | undefined
  const visible = () => state.route !== "config" && (state.searchOpen || !!state.searchQuery)
  const filteredCount = () => issueList(state).length
  const loadedCount = () => allIssues(state).length

  return (
    <Show when={visible()}>
      <box borderStyle="rounded" borderColor={state.searchOpen ? theme.borderActive : theme.border} paddingLeft={1} paddingRight={1} height={3} flexShrink={0} flexDirection="row" gap={1} alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={theme.warning} wrapMode="none">Filter loaded</text>
        <Show when={state.searchOpen} fallback={
          <text fg={theme.textMuted} wrapMode="none">{state.searchQuery || "empty"} · {filteredCount()}/{loadedCount()} loaded · / edit · empty Enter clears</text>
        }>
          <input
            value={state.searchDraft}
            onInput={(value) => appState.updateSearchDraft(value)}
            onSubmit={() => appState.commitSearch()}
            ref={(element: InputRenderable) => {
              input = element
              setTimeout(() => input && !input.isDestroyed && input.focus(), 1)
            }}
            placeholder="status:blocked assignee:duy auth"
            placeholderColor={theme.textSubtle}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.accent}
            backgroundColor={theme.panel}
            focusedBackgroundColor={theme.panel}
            flexGrow={1}
          />
          <text fg={theme.textSubtle} wrapMode="none">{filteredCount()}/{loadedCount()} loaded</text>
        </Show>
      </box>
    </Show>
  )
}

function Footer() {
  const { state } = useAppState()
  const theme = useTheme()
  const toast = useToast()

  return (
    <box height={1} paddingLeft={1} paddingRight={1} backgroundColor={theme.panel} flexDirection="row" justifyContent="space-between">
      <text fg={theme.textMuted}>{state.searchOpen ? "filter loaded: type query  enter apply  esc close  empty enter clears" : footerText(state.focusedPane, state.route, state.stagedDiscardOpen, state.remoteApplyOpen, state.authOnboarding.open, state.projectPicker.open)}</text>
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

function AuthOnboardingPopup() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const step = () => state.authOnboarding.step
  const value = () => state.authOnboarding[authOnboardingField(step())]
  useAuthOnboardingKeyboard(appState)

  return (
    <Show when={state.authOnboarding.open}>
      <ModalFrame borderColor={theme.accent} width={82}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>Connect Jira</text>
          <text fg={theme.textSubtle}>single local account · Esc skip demo</text>
        </box>
        <text fg={theme.textMuted}>lazyjira can use one saved Atlassian API token config for now.</text>
        <text fg={theme.textSubtle}>Config file: ~/.config/lazyjira/config.json · CLI alternative: lazyjira auth login</text>
        <text fg={theme.warning} wrapMode="none">Step {stepIndex(step())}/3 · {stepTitle(step())}</text>
        <Show when={state.authOnboarding.error}>
          {(error) => <text fg={theme.danger} wrapMode="none">{error()}</text>}
        </Show>
        <input
          value={value()}
          onInput={(nextValue) => appState.updateAuthOnboardingValue(nextValue)}
          onSubmit={() => void appState.submitAuthOnboarding()}
          ref={(element: InputRenderable) => {
            setTimeout(() => !element.isDestroyed && element.focus(), 1)
          }}
          placeholder={stepPlaceholder(step())}
          placeholderColor={theme.textSubtle}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.accent}
          backgroundColor={theme.panel}
          focusedBackgroundColor={theme.panel}
        />
        <Show when={step() === "apiToken"}>
          <text fg={theme.warning}>Token entry is visible in this first TUI flow. Use `lazyjira auth login` if you prefer terminal-hidden entry.</text>
        </Show>
        <text fg={theme.textSubtle} wrapMode="none">Enter continue/save · Esc skip and stay in demo</text>
        <Show when={state.authOnboarding.saving}>
          <text fg={theme.textMuted}>Saving credentials...</text>
        </Show>
      </ModalFrame>
    </Show>
  )
}

function ProjectPickerPopup() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const rows = () => projectPickerRows(state)
  useProjectPickerKeyboard(appState)

  createEffect(() => {
    if (!state.projectPicker.open || state.projectPicker.loading || state.projectPicker.error) return
    if (state.projectPicker.step === "project" && !state.projectPicker.projects.length) void appState.refreshProjectPicker()
  })

  return (
    <Show when={state.projectPicker.open}>
      <ModalFrame borderColor={theme.accent} width={88}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>{state.projectPicker.step === "project" ? "Choose Jira Project" : "Choose Jira Board"}</text>
          <text fg={theme.textSubtle}>j/k choose · enter select · r reload · Esc close</text>
        </box>
        <text fg={theme.textMuted}>lazyjira keeps one active Jira project context at a time.</text>
        <Show when={state.demoMode}>
          <text fg={theme.warning}>Using mock Jira discovery data in demo mode; no Jira fetch is made here yet.</text>
        </Show>
        <Show when={state.projectPicker.step === "board" && state.projectPicker.selectedProject}>
          {(project) => <text fg={theme.warning} wrapMode="none">Project: {project().key} {project().name} · h/backspace picks another project</text>}
        </Show>
        <Show when={state.projectPicker.error}>
          {(error) => <text fg={theme.danger} wrapMode="none">{error()}</text>}
        </Show>
        <Show when={state.projectPicker.loading || state.projectPicker.saving}>
          <text fg={theme.textMuted}>{state.projectPicker.saving ? "Saving workspace..." : "Loading from Jira..."}</text>
        </Show>
        <Show when={rows().length} fallback={<text fg={theme.textMuted}>No options loaded. Press r to retry.</text>}>
          <For each={visibleProjectPickerRows(rows(), state.projectPicker.selectedIndex)}>
            {(row) => (
              <text fg={row.selected ? theme.selectedText : theme.text} bg={row.selected ? theme.selected : undefined} wrapMode="none">
                {row.selected ? ">" : " "} {row.title} · {row.subtitle}
              </text>
            )}
          </For>
        </Show>
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

function useAuthOnboardingKeyboard(appState: ReturnType<typeof useAppState>) {
  const renderer = useRenderer()
  onMount(() => {
    const handler = (event: KeyEvent) => {
      if (!appState.state.authOnboarding.open) return
      if (event.name === "escape") {
        event.preventDefault()
        event.stopPropagation()
        appState.closeAuthOnboarding()
        return
      }
    }
    renderer.keyInput.prependListener("keypress", handler)
    onCleanup(() => renderer.keyInput.off("keypress", handler))
  })
}

function useProjectPickerKeyboard(appState: ReturnType<typeof useAppState>) {
  const renderer = useRenderer()
  onMount(() => {
    const handler = (event: KeyEvent) => {
      if (!appState.state.projectPicker.open) return
      if (event.name === "return") {
        event.preventDefault()
        event.stopPropagation()
        void appState.selectProjectPickerItem()
        return
      }
      if (event.name === "j" || event.name === "down") {
        event.preventDefault()
        event.stopPropagation()
        appState.moveProjectPickerSelection(1)
        return
      }
      if (event.name === "k" || event.name === "up") {
        event.preventDefault()
        event.stopPropagation()
        appState.moveProjectPickerSelection(-1)
        return
      }
      if (event.name === "r") {
        event.preventDefault()
        event.stopPropagation()
        void appState.refreshProjectPicker()
        return
      }
      if ((event.name === "h" || event.name === "left" || event.name === "backspace") && appState.state.projectPicker.step === "board") {
        event.preventDefault()
        event.stopPropagation()
        appState.backProjectPickerStep()
        return
      }
      if (event.name === "escape" || event.name === "q") {
        event.preventDefault()
        event.stopPropagation()
        appState.closeProjectPicker()
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

function footerText(focusedPane: string, route: string, stagedDiscardOpen: boolean, remoteApplyOpen: boolean, authOnboardingOpen: boolean, projectPickerOpen: boolean) {
  if (authOnboardingOpen) return "jira setup: Enter continue/save  Esc skip demo"
  if (projectPickerOpen) return "project picker: j/k choose  enter select  r reload  esc/q close"
  if (remoteApplyOpen) return "remote write: W final apply placeholder  esc/q close"
  if (stagedDiscardOpen) return "discard staged: j/k choose  space mark  enter discard  esc/q close"
  if (focusedPane === "sidebar") return "sidebar: j/k choose  enter/l open/toggle  space filter  P project  q quit"
  if (focusedPane === "inspector") return "inspector: j/k field  e/enter edit  ctrl-enter stage  x delete  X discard  w render  W Jira"
  if (route === "issue-detail") return "detail: j/k line  d/u half-page  e edit body  ctrl-enter stage  X discard  w render  W Jira"
  if (route === "workspace") return "workspace: j/k choose  d/u page  enter open  / filter  P project  X discard  W Jira"
  if (route === "config") return "config: j/k choose  h/l pane  a add  e rename  c color  P project  W Jira"
  if (route === "active-sprint") return "sprint: j/k card  h/l column  / filter  P project  n new  W Jira"
  if (route === "kanban") return "kanban: j/k same status  h/l next cell  / filter  P project  g group  W Jira"
  if (route === "backlog") return "backlog: j/k row  h/l group  / filter  P project  n new  W Jira"
  return "1 workspace  2 sprint  3 backlog  4 kanban  P project  / filter loaded  q quit"
}

function runtimeModeText(config: ReturnType<typeof useConfig>, jiraAuthReady = false, jiraProjectReady = false) {
  if (config.runtimeMode === "demo") return jiraProjectReady ? "demo mode · mock project selected" : "demo mode · mock projects"
  if (jiraProjectReady) return "jira mode · project selected"
  if (config.jira || jiraAuthReady) return "jira mode · choose project"
  return "jira mode · no auth"
}

function projectPickerRows(state: AppState) {
  if (state.projectPicker.step === "project") {
    return state.projectPicker.projects.map((project, index) => ({
      id: project.id,
      title: `${project.key} ${project.name}`,
      subtitle: "project",
      selected: index === state.projectPicker.selectedIndex,
    }))
  }
  return state.projectPicker.boards.map((board, index) => ({
    id: board.id,
    title: board.name,
    subtitle: `${board.type} board · ${board.id}`,
    selected: index === state.projectPicker.selectedIndex,
  }))
}

function visibleProjectPickerRows<T>(rows: T[], selectedIndex: number) {
  const maxRows = 12
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(maxRows / 2), rows.length - maxRows))
  return rows.slice(start, start + maxRows)
}

function authOnboardingField(step: "baseUrl" | "email" | "apiToken") {
  return step
}

function stepIndex(step: "baseUrl" | "email" | "apiToken") {
  if (step === "baseUrl") return 1
  if (step === "email") return 2
  return 3
}

function stepTitle(step: "baseUrl" | "email" | "apiToken") {
  if (step === "baseUrl") return "Jira site URL"
  if (step === "email") return "Atlassian email"
  return "API token"
}

function stepPlaceholder(step: "baseUrl" | "email" | "apiToken") {
  if (step === "baseUrl") return "https://your-domain.atlassian.net"
  if (step === "email") return "you@example.com"
  return "Atlassian API token"
}
