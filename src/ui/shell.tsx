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
import { filteredProjectPickerBoards, filteredProjectPickerProjects, filteredProjectPickerWorkspaces } from "../state/project-picker"
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
        <text fg={theme.textSubtle}>{runtimeEnvText(config, state.jiraAuthReady, state.jiraProjectReady)}</text>
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
  const visible = () => state.route !== "config" && (state.searchOpen || !!state.searchQuery || !!state.remoteSearchQuery || !!state.remoteSearchIssueKeys.length || state.remoteSearchPageState.loading || !!state.remoteSearchPageState.error)
  const remoteMode = () => state.searchMode === "remote"
  const filteredCount = () => issueList(state).length
  const loadedCount = () => allIssues(state).length
  const remoteLoadedCount = () => state.remoteSearchIssueKeys.length
  const remoteTotal = () => typeof state.remoteSearchPageState.total === "number" ? `/${state.remoteSearchPageState.total}` : ""

  return (
    <Show when={visible()}>
      <box borderStyle="rounded" borderColor={state.searchOpen ? theme.borderActive : theme.border} paddingLeft={1} paddingRight={1} height={3} flexShrink={0} flexDirection="row" gap={1} alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={remoteMode() ? theme.accent : theme.warning} wrapMode="none">{remoteMode() ? "Search Jira" : "Filter loaded"}</text>
        <Show when={state.searchOpen} fallback={
          <text fg={state.remoteSearchPageState.error && remoteMode() ? theme.danger : theme.textMuted} wrapMode="none">
            {remoteMode()
              ? `${state.remoteSearchQuery || "empty"} · ${remoteLoadedCount()}${remoteTotal()} Jira results${state.remoteSearchPageState.loading ? " · loading" : state.remoteSearchPageState.error ? ` · ${state.remoteSearchPageState.error}` : ""} · S edit`
              : `${state.searchQuery || "empty"} · ${filteredCount()}/${loadedCount()} loaded · / edit · empty Enter clears`}
          </text>
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
          <text fg={theme.textSubtle} wrapMode="none">{remoteMode() ? `${remoteLoadedCount()}${remoteTotal()} Jira` : `${filteredCount()}/${loadedCount()} loaded`}</text>
        </Show>
      </box>
    </Show>
  )
}

function Footer() {
  const { state } = useAppState()
  const theme = useTheme()
  const toast = useToast()
  const items = () => state.searchOpen
    ? state.searchMode === "remote" ? ["search Jira", "type text", "enter run", "esc close", "empty enter clears"] : ["filter loaded", "type query", "enter apply", "esc close", "empty enter clears"]
    : footerItems(state.focusedPane, state.route, state.stagedDiscardOpen, state.remoteApplyOpen, state.authOnboarding.open, state.projectPicker.open ? state.projectPicker.mode : undefined)

  return (
    <box height={1} paddingLeft={1} paddingRight={1} backgroundColor={theme.panel} flexDirection="row" justifyContent="space-between">
      <FooterHints items={items()} />
      <text fg={theme.textSubtle}>{toast.message() ?? "dev/prod runtime scaffold"}</text>
    </box>
  )
}

function FooterHints(props: { items: string[] }) {
  const theme = useTheme()

  return (
    <text wrapMode="none">
      <For each={props.items}>
        {(item, index) => (
          <>
            <Show when={index() > 0}>
              <span style={{ fg: theme.textSubtle }}> · </span>
            </Show>
            <span style={{ fg: index() % 2 === 0 ? theme.text : theme.textMuted }}>{item}</span>
          </>
        )}
      </For>
    </text>
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
                  <text fg={change.kind === "delete" ? theme.danger : change.kind === "create" ? theme.accent : selected() ? theme.selectedText : theme.text} bg={selected() ? theme.selected : undefined} wrapMode="none">
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
              <text fg={change.kind === "delete" ? theme.danger : change.kind === "create" ? theme.accent : change.kind === "config" ? theme.warning : theme.text} wrapMode="none">
                {change.kind === "delete" ? "-" : change.kind === "create" ? "+" : "~"} {stagedChangeText(change, change.kind === "config" ? undefined : issueByKey(state, change.issueKey)?.title)}
              </text>
            )}
          </For>
        </Show>
        <text fg={theme.warning} wrapMode="none">Jira writes are not wired yet; confirming now keeps staged changes intact.</text>
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
          <text fg={theme.textSubtle}>single local account · Esc skip prod setup</text>
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
        <text fg={theme.textSubtle} wrapMode="none">Enter continue/save · Esc skip prod setup</text>
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
  let searchInput: InputRenderable | undefined
  const rows = () => projectPickerRows(state)
  const totalCount = () => projectPickerTotalCount(state)
  const optionLabel = () => state.projectPicker.mode === "local" ? "workspaces" : state.projectPicker.mode === "remote-projects" ? "projects" : "boards"
  useProjectPickerKeyboard(appState)

  createEffect(() => {
    if (!state.projectPicker.searchOpen) return
    setTimeout(() => searchInput && !searchInput.isDestroyed && searchInput.focus(), 1)
  })

  return (
    <Show when={state.projectPicker.open}>
      <ModalFrame borderColor={theme.accent} width={88}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>{projectPickerTitle(state)}</text>
          <text fg={theme.textSubtle}>{projectPickerHint(state)}</text>
        </box>
        <text fg={theme.textMuted}>P switches saved workspaces instantly. Press a only when you want Jira discovery.</text>
        <Show when={state.runtimeEnv === "dev"}>
          <text fg={theme.warning}>Using dev runtime fixtures. New data-backed features need matching dev fixture data.</text>
        </Show>
        <Show when={state.projectPicker.mode === "remote-boards" && state.projectPicker.selectedProject}>
          {(project) => <text fg={theme.warning} wrapMode="none">Project: {project().key} {project().name} · h/backspace returns to remote projects</text>}
        </Show>
        <Show when={state.projectPicker.error}>
          {(error) => <text fg={theme.danger} wrapMode="none">{error()}</text>}
        </Show>
        <Show when={state.projectPicker.loading || state.projectPicker.saving}>
          <text fg={theme.textMuted}>{state.projectPicker.saving ? "Saving workspace..." : "Loading from Jira..."}</text>
        </Show>
        <Show when={state.projectPicker.searchOpen || state.projectPicker.searchQuery} fallback={<text fg={theme.textSubtle}>Press / to filter · {rows().length}/{totalCount()} {optionLabel()}</text>}>
          <box borderStyle="rounded" borderColor={state.projectPicker.searchOpen ? theme.borderActive : theme.border} paddingLeft={1} paddingRight={1} height={3} flexDirection="row" gap={1} alignItems="center">
            <text attributes={TextAttributes.BOLD} fg={theme.warning} wrapMode="none">Filter</text>
            <input
              value={state.projectPicker.searchQuery}
              onInput={(value) => appState.updateProjectPickerSearch(value)}
              onSubmit={() => void appState.selectProjectPickerItem()}
              ref={(element: InputRenderable) => {
                searchInput = element
                setTimeout(() => !element.isDestroyed && element.focus(), 1)
              }}
              placeholder={projectPickerPlaceholder(state)}
              placeholderColor={theme.textSubtle}
              textColor={theme.text}
              focusedTextColor={theme.text}
              cursorColor={theme.accent}
              backgroundColor={theme.panel}
              focusedBackgroundColor={theme.panel}
              flexGrow={1}
            />
            <text fg={theme.textSubtle} wrapMode="none">{rows().length}/{totalCount()}</text>
          </box>
        </Show>
        <Show when={rows().length} fallback={<text fg={theme.textMuted}>{projectPickerEmptyText(state)}</text>}>
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
      if (appState.state.projectPicker.searchOpen) {
        if (event.name === "up") {
          event.preventDefault()
          event.stopPropagation()
          appState.moveProjectPickerSelection(-1)
          return
        }
        if (event.name === "down") {
          event.preventDefault()
          event.stopPropagation()
          appState.moveProjectPickerSelection(1)
          return
        }
        if (event.name === "escape") {
          event.preventDefault()
          event.stopPropagation()
          if (appState.state.projectPicker.searchQuery) appState.clearProjectPickerSearch()
          else appState.closeProjectPicker()
          return
        }
        return
      }
      if (event.name === "/") {
        event.preventDefault()
        event.stopPropagation()
        appState.openProjectPickerSearch()
        return
      }
      if (event.name === "a" && appState.state.projectPicker.mode === "local") {
        event.preventDefault()
        event.stopPropagation()
        void appState.browseRemoteProjects()
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
      if (event.name === "r" && appState.state.projectPicker.mode !== "local") {
        event.preventDefault()
        event.stopPropagation()
        void appState.refreshProjectPicker()
        return
      }
      if ((event.name === "h" || event.name === "left" || event.name === "backspace") && appState.state.projectPicker.mode !== "local") {
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
  if (change.kind === "create") return `${change.issueKey} create issue · ${issueTitle ?? "New issue"}`
  if (change.kind === "delete") return `${change.issueKey} delete issue · ${issueTitle ?? "Unknown issue"}`
  const preview = change.value.replace(/\s+/g, " ").slice(0, 48)
  return `${change.issueKey} ${change.label} · ${preview}`
}

function footerItems(focusedPane: string, route: string, stagedDiscardOpen: boolean, remoteApplyOpen: boolean, authOnboardingOpen: boolean, projectPickerMode?: AppState["projectPicker"]["mode"]) {
  if (authOnboardingOpen) return ["prod setup", "Enter continue/save", "Esc skip setup"]
  if (projectPickerMode === "local") return ["workspace switcher", "/ filter local", "enter switch", "a browse Jira", "esc/q close"]
  if (projectPickerMode === "remote-projects") return ["remote projects", "/ filter", "j/k choose", "enter load boards", "r refresh", "h local"]
  if (projectPickerMode === "remote-boards") return ["remote boards", "/ filter", "j/k choose", "enter switch", "r refresh boards", "h projects"]
  if (remoteApplyOpen) return ["remote write", "W final apply placeholder", "esc/q close"]
  if (stagedDiscardOpen) return ["discard staged", "j/k choose", "space mark", "enter discard", "esc/q close"]
  if (focusedPane === "sidebar") return ["sidebar", "j/k choose", "enter/l open/toggle", "space filter", "P project", "q quit"]
  if (focusedPane === "inspector") return ["inspector", "j/k field", "e/enter edit", "ctrl-enter stage", "x delete", "X discard", "w render", "W Jira"]
  if (route === "issue-detail") return ["detail", "j/k line", "d/u half-page", "e edit body", "r refresh", "ctrl-enter stage", "W Jira"]
  if (route === "workspace") return ["workspace", "j/k choose", "d/u page", "enter open", "/ filter", "S Jira search", "W Jira"]
  if (route === "config") return ["config", "j/k choose", "d/u page", "h/l pane", "a add", "e rename", "c color", "W Jira"]
  if (route === "active-sprint") return ["sprint", "j/k card", "h/l column", "enter open/new", "/ filter", "S Jira search", "W Jira"]
  if (route === "kanban") return ["kanban", "j/k row", "h/l column", "enter open/new", "L load more", "S Jira search", "W Jira"]
  if (route === "backlog") return ["backlog", "j/k row", "h/l group", "L load more", "/ filter", "S Jira search", "W Jira"]
  return ["1 workspace", "2 sprint", "3 backlog", "4 kanban", "P project", "/ filter loaded", "q quit"]
}

function runtimeEnvText(config: ReturnType<typeof useConfig>, jiraAuthReady = false, jiraProjectReady = false) {
  if (config.runtimeEnv === "dev") return jiraProjectReady ? "dev runtime · fixture project selected" : "dev runtime · fixture projects"
  if (jiraProjectReady) return "prod runtime · project selected"
  if (config.jira || jiraAuthReady) return "prod runtime · choose project"
  return "prod runtime · no auth"
}

function projectPickerRows(state: AppState) {
  if (state.projectPicker.mode === "local") {
    return filteredProjectPickerWorkspaces(state).map((workspace, index) => {
      const active = state.project.key === workspace.projectKey && state.board.id === workspace.boardId
      return {
        id: workspace.id,
        title: `${workspace.projectKey} ${workspace.projectName}`,
        subtitle: `${workspace.boardName} · ${workspace.boardType} board${active ? " · active" : ""}`,
        selected: index === state.projectPicker.selectedIndex,
      }
    })
  }
  if (state.projectPicker.mode === "remote-projects") {
    return filteredProjectPickerProjects(state).map((project, index) => ({
      id: project.id,
      title: `${project.key} ${project.name}`,
      subtitle: "project",
      selected: index === state.projectPicker.selectedIndex,
    }))
  }
  return filteredProjectPickerBoards(state).map((board, index) => ({
    id: board.id,
    title: board.name,
    subtitle: `${board.type} board · ${board.id}`,
    selected: index === state.projectPicker.selectedIndex,
  }))
}

function projectPickerTotalCount(state: AppState) {
  if (state.projectPicker.mode === "local") return state.recentWorkspaces.length
  if (state.projectPicker.mode === "remote-projects") return state.projectPicker.remoteProjectCache?.length ?? 0
  const projectKey = state.projectPicker.selectedProject?.key
  return projectKey ? (state.projectPicker.remoteBoardsByProject[projectKey]?.length ?? 0) : 0
}

function projectPickerTitle(state: AppState) {
  if (state.projectPicker.mode === "local") return "Switch Workspace"
  if (state.projectPicker.mode === "remote-projects") return "Browse Jira Projects"
  return "Choose Jira Board"
}

function projectPickerHint(state: AppState) {
  if (state.projectPicker.mode === "local") return "/ filter · j/k choose · enter switch · a add · Esc close"
  if (state.projectPicker.mode === "remote-projects") return "/ filter · j/k choose · enter boards · r refresh · h local"
  return "/ filter · j/k choose · enter switch · r refresh · h projects"
}

function projectPickerPlaceholder(state: AppState) {
  if (state.projectPicker.mode === "local") return "project, board, or type"
  if (state.projectPicker.mode === "remote-projects") return "project key or name"
  return "board name or type"
}

function projectPickerEmptyText(state: AppState) {
  if (state.projectPicker.searchQuery) return "No matches. Edit the filter or press Esc."
  if (state.projectPicker.mode === "local") return "No saved workspaces yet. Press a to browse Jira projects."
  if (state.projectPicker.mode === "remote-projects") return "No projects loaded. Press r to retry."
  return "No boards loaded for this project. Press r to retry."
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
