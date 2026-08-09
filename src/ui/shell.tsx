import { TextAttributes, type InputRenderable, type KeyEvent, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { useRenderer, useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, onCleanup, onMount, Show, type JSX } from "solid-js"
import { useAppState } from "../context/app-state"
import { useConfig } from "../context/config"
import { useIcons } from "../context/icons"
import { useTheme, useThemeContext } from "../context/theme"
import { useToast } from "../context/toast"
import { RouteSurface } from "../routes"
import { issueByKey } from "../state/issue-drafts"
import { planJiraWrites, writePlanCounts, type JiraWritePlanItem } from "../state/jira-write-plan"
import type { AppState } from "../state/app-state"
import { filteredProjectPickerBoards, filteredProjectPickerProjects, filteredProjectPickerWorkspaces, projectPageStatus } from "../state/project-picker"
import { boardCapabilities, routeLabel, sidebarQuickFilterIndex, sidebarRoutesForBoard, type AppRoute } from "../state/routes"
import { allIssues, issueList } from "../state/selectors"
import { stagedChanges, type StagedChange } from "../state/staged-changes"
import { IssueInspector } from "./issue-inspector"
import { paletteCommandsForBoard, routeHelpCommands, searchPaletteCommands, type PaletteCommand, type PaletteCommandIcon } from "../keymap/commands"
import { iconModes, selectIcons, type SemanticIconCatalog } from "../icons/catalog"
import { useBindings, useKeymap } from "../context/keymap"

export function AppShell() {
  const dimensions = useTerminalDimensions()
  const narrow = () => dimensions().width < 100
  const renderer = useRenderer()
  const themeContext = useThemeContext()
  const theme = useTheme()
  const { state } = useAppState()

  createEffect(() => {
    renderer.setBackgroundColor(theme.background)
  })

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
      <CommentComposerPopup />
      <CommandPalettePopup />
      <IconModePickerPopup />
      <ThemePickerPopup />
      <HelpPopup />
    </box>
  )
}

function Sidebar() {
  const { state, setFocusedPane, setRoute, toggleQuickFilter } = useAppState()
  const config = useConfig()
  const icons = useIcons()
  const theme = useTheme()
  const focused = () => state.focusedPane === "sidebar"
  const routes = () => sidebarRoutesForBoard(state.board)
  const globalRoutes = () => routes().filter((route) => route.scope === "global")
  const projectRoutes = () => routes().filter((route) => route.scope === "project")
  const pendingCount = () => stagedChanges(state).length

  return (
    <box borderStyle="rounded" borderColor={focused() ? theme.borderActive : theme.border} padding={1} width={26} flexShrink={0} onMouseUp={() => setFocusedPane("sidebar")}>
        <text attributes={TextAttributes.BOLD} fg={theme.text}>{config.appName}</text>
        <text fg={theme.textMuted}>{state.project.key} {state.project.name}</text>
        <text fg={theme.textSubtle}>{state.board.name} · {state.board.type === "scrum" ? "Scrum" : "Kanban"}</text>
        <text fg={theme.textSubtle}>{runtimeEnvText(config, state.jiraAuthReady, state.jiraProjectReady)}</text>
      <box paddingTop={1} flexDirection="column">
        <text fg={theme.warning}>Global</text>
        <For each={globalRoutes()}>
          {(route) => {
            const routeIndex = () => routes().findIndex((candidate) => candidate.id === route.id)
            const selected = () => state.sidebarSelectedIndex === routeIndex()
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
                {selected() ? icons.catalog.structural.selection : current() ? icons.catalog.status.inProgress : " "} {routeIcon(icons.catalog, route.id)} {route.shortLabel}
              </text>
            )
          }}
        </For>
      </box>
      <box paddingTop={1} flexDirection="column">
        <text fg={theme.warning}>Project</text>
        <For each={projectRoutes()}>
          {(route) => {
            const routeIndex = () => routes().findIndex((candidate) => candidate.id === route.id)
            const selected = () => state.sidebarSelectedIndex === routeIndex()
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
                {selected() ? icons.catalog.structural.selection : current() ? icons.catalog.status.inProgress : " "} {routeIcon(icons.catalog, route.id)} {route.shortLabel}
              </text>
            )
          }}
        </For>
      </box>
      <box paddingTop={1} flexDirection="column">
        <text fg={theme.warning}>Quick Filters</text>
        <For each={state.quickFilters}>
          {(filter, index) => {
            const sidebarIndex = () => sidebarQuickFilterIndex(state.board, index())
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
      <box paddingTop={1} flexDirection="column">
        <text fg={theme.warning}>Pending</text>
        <text fg={pendingCount() ? theme.text : theme.textMuted}>  {icons.catalog.exceptional.staged} {pendingCount()} staged {pendingCount() === 1 ? "change" : "changes"}</text>
      </box>
    </box>
  )
}

function MainSurface() {
  const { state, setFocusedPane } = useAppState()
  const icons = useIcons()
  const keymap = useKeymap()
  const theme = useTheme()
  const focused = () => state.focusedPane === "main"

  return (
    <box borderStyle="rounded" borderColor={focused() ? theme.borderActive : theme.border} padding={1} flexGrow={1} flexShrink={1} minWidth={0} minHeight={0} onMouseUp={() => setFocusedPane("main")}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>{routeIcon(icons.catalog, state.route)} {routeLabel(state.route, state.board)}</text>
        <box flexDirection="row" gap={1}>
          <text fg={theme.textSubtle}>{state.board.name}</text>
          <box width={14} height={1} backgroundColor={theme.danger} alignItems="center" justifyContent="center" onMouseUp={() => keymap.runCommand("app.report-bug")}>
            <text attributes={TextAttributes.BOLD} fg={theme.background}>B REPORT BUG</text>
          </box>
        </box>
      </box>
      <Show when={(state.workspaceLoading || state.workspaceLoadError) && !!Object.keys(state.issues).length}>
        <WorkspaceRefreshStatus />
      </Show>
      <box paddingTop={1} flexDirection="column" flexGrow={1} minHeight={0}>
        <SearchBar />
        <box paddingTop={state.route !== "config" && (state.searchOpen || state.searchQuery) ? 1 : 0} flexGrow={1} minHeight={0}>
          <Show when={(state.workspaceLoading || state.workspaceLoadError) && !Object.keys(state.issues).length} fallback={<RouteSurface />}>
            <WorkspaceLoadSurface />
          </Show>
        </box>
      </box>
    </box>
  )
}

function WorkspaceLoadSurface() {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()

  return (
    <box flexGrow={1} minHeight={0} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text attributes={TextAttributes.BOLD} fg={state.workspaceLoadError ? theme.danger : theme.accent}>
        {state.workspaceLoadError ? `${icons.catalog.exceptional.error} Jira workspace load failed` : `${icons.catalog.exceptional.loading} Loading Jira workspace`}
      </text>
      <text fg={theme.text}>{state.project.key} {state.project.name} · {state.board.name}</text>
      <Show when={state.workspaceLoadError} fallback={<text fg={theme.textMuted}>Loading board metadata, sprints, and the first issue pages...</text>}>
        {(error) => <text fg={theme.danger}>{error()}</text>}
      </Show>
      <text fg={theme.textSubtle}>{state.workspaceLoadError ? "r retry · P switch workspace · q quit" : "P switch workspace · q quit"}</text>
    </box>
  )
}

function WorkspaceRefreshStatus() {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()

  return (
    <text fg={state.workspaceLoadError ? theme.danger : theme.warning} wrapMode="none">
      {state.workspaceLoadError ? `${icons.catalog.exceptional.error} Workspace refresh failed: ${state.workspaceLoadError} · r retry` : `${icons.catalog.action.refresh} Updating Jira workspace...`}
    </text>
  )
}

function SearchBar() {
  const appState = useAppState()
  const { state } = appState
  const icons = useIcons()
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
        <text attributes={TextAttributes.BOLD} fg={remoteMode() ? theme.accent : theme.warning} wrapMode="none">{icons.catalog.action.search} {remoteMode() ? "Search Jira" : "Filter loaded"}</text>
        <Show when={state.searchOpen} fallback={
          <text fg={state.remoteSearchPageState.error && remoteMode() ? theme.danger : theme.textMuted} wrapMode="none">
            {remoteMode()
              ? `${state.remoteSearchQuery || "empty"} · ${remoteLoadedCount()}${remoteTotal()} Jira results${state.remoteSearchPageState.loading ? ` · ${icons.catalog.exceptional.loading} loading` : state.remoteSearchPageState.error ? ` · ${icons.catalog.exceptional.error} ${state.remoteSearchPageState.error}` : ""} · S edit`
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
  const selectedIssue = () => issueByKey(state, state.selectedIssueKey)
  const items = () => state.iconModePickerOpen
    ? ["icon mode", "j/k choose", "enter apply", "esc close"]
    : state.themePickerOpen
    ? ["theme picker", "j/k choose", "enter apply", "esc close"]
    : state.commandPaletteOpen
    ? ["command palette", "type filter", "up/down choose", "enter run", "esc close"]
    : state.searchOpen
    ? state.searchMode === "remote" ? ["search Jira", "type text", "enter run", "esc close", "empty enter clears"] : ["filter loaded", "type query", "enter apply", "esc close", "empty enter clears"]
    : footerItems(state.focusedPane, state.route, state.board, state.stagedDiscardOpen, state.remoteApplyOpen, state.authOnboarding.open, state.projectPicker.open ? state.projectPicker.mode : undefined, !!(selectedIssue()?.parentKey ?? selectedIssue()?.parent?.key), state.detailSectionFocus)

  return (
    <box height={1} paddingLeft={1} paddingRight={1} backgroundColor={theme.panel} flexDirection="row" justifyContent="space-between">
      <FooterHints items={items()} />
      <text fg={theme.textSubtle}>{toast.message() ?? "dev/prod runtime scaffold"}</text>
    </box>
  )
}

function CommandPalettePopup() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const icons = useIcons()
  const keymap = useKeymap()
  const dimensions = useTerminalDimensions()
  let input: InputRenderable | undefined
  let scrollbox: ScrollBoxRenderable | undefined
  const commands = () => searchPaletteCommands(state.commandPaletteQuery, state.board)
  const listHeight = () => Math.max(4, dimensions().height - 12)

  createEffect(() => {
    if (!state.commandPaletteOpen) return
    setTimeout(() => input && !input.isDestroyed && input.focus(), 1)
  })

  createEffect(() => {
    if (!state.commandPaletteOpen) return
    scrollbox?.scrollChildIntoView(commandPaletteRowId(state.commandPaletteSelectedIndex))
  })

  return (
    <Show when={state.commandPaletteOpen}>
      <ModalFrame borderColor={theme.accent} width={88} centered>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>{icons.catalog.action.search} Command Palette</text>
          <text fg={theme.textSubtle}>; · : actions</text>
        </box>
        <input
          value={state.commandPaletteQuery}
          onInput={(value) => appState.updateCommandPaletteQuery(value)}
          onSubmit={() => runSelectedCommand()}
          ref={(element: InputRenderable) => (input = element)}
          placeholder="Type an action, key, or description"
          placeholderColor={theme.textSubtle}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.accent}
          backgroundColor={theme.panel}
          focusedBackgroundColor={theme.panel}
        />
        <text fg={theme.textSubtle} wrapMode="none">{commands().length} commands · type to filter · up/down choose · enter run · esc close</text>
        <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} height={listHeight()} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
          <Show when={commands().length} fallback={<text fg={theme.textMuted}>No commands match "{state.commandPaletteQuery}".</text>}>
            <For each={commands()}>
              {(command, index) => <CommandPaletteRow id={commandPaletteRowId(index())} command={command} selected={index() === state.commandPaletteSelectedIndex} />}
            </For>
          </Show>
        </scrollbox>
      </ModalFrame>
    </Show>
  )

  function runSelectedCommand() {
    const command = commands()[state.commandPaletteSelectedIndex]
    if (!command) return
    appState.closeCommandPalette()
    keymap.runCommand(command.name)
  }
}

function CommandPaletteRow(props: { id: string; command: PaletteCommand; selected: boolean }) {
  const icons = useIcons()
  const theme = useTheme()
  return (
    <box id={props.id} height={3} paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? theme.selected : undefined} flexDirection="column">
      <box flexDirection="row" gap={2}>
        <text fg={props.selected ? theme.selectedText : theme.warning} width={16} wrapMode="none">{props.command.keys}</text>
        <text attributes={TextAttributes.BOLD} fg={props.selected ? theme.selectedText : theme.text} wrapMode="none">{props.command.icon ? `${paletteIcon(icons.catalog, props.command.icon)} ` : ""}{props.command.label}</text>
      </box>
      <text fg={props.selected ? theme.selectedText : theme.textMuted} wrapMode="none">{props.command.description} · {props.command.group}</text>
    </box>
  )
}

function commandPaletteRowId(index: number) {
  return `command-palette-row-${index}`
}

function IconModePickerPopup() {
  const { state } = useAppState()
  const icons = useIcons()
  const theme = useTheme()

  return (
    <Show when={state.iconModePickerOpen}>
      <ModalFrame borderColor={theme.accent} width={72} centered>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>{icons.catalog.route.config} Change Icon Mode</text>
          <text fg={theme.textSubtle}>current: {icons.mode}</text>
        </box>
        <Show when={icons.locked}>
          <text fg={theme.warning}>{icons.catalog.exceptional.warning} LAZYJIRA_ICON_MODE is active and overrides saved selection.</text>
        </Show>
        <For each={iconModes}>
          {(mode, index) => {
            const catalog = selectIcons(mode).catalog
            const selected = () => index() === state.iconModePickerSelectedIndex
            return (
              <box height={3} paddingLeft={1} paddingRight={1} backgroundColor={selected() ? theme.selected : undefined} flexDirection="column">
                <box flexDirection="row" justifyContent="space-between">
                  <text attributes={TextAttributes.BOLD} fg={selected() ? theme.selectedText : theme.text}>{selected() ? `${catalog.structural.selection} ` : "  "}{iconModeLabel(mode)}</text>
                  <text fg={selected() ? theme.selectedText : theme.textMuted}>{icons.mode === mode ? "active" : ""}</text>
                </box>
                <text fg={selected() ? theme.selectedText : theme.textMuted}>{catalog.route.workspace} workspace  {catalog.issueType.bug} bug  {catalog.status.inProgress} in progress  {catalog.priority.high} high  {catalog.action.apply} apply</text>
              </box>
            )
          }}
        </For>
        <text fg={theme.textSubtle}>j/k or arrows choose · enter apply and save · esc close</text>
      </ModalFrame>
    </Show>
  )
}

function ThemePickerPopup() {
  const appState = useAppState()
  const { state } = appState
  const themeContext = useThemeContext()
  const theme = useTheme()
  const toast = useToast()

  const options = () => state.themePickerCatalog?.length ? state.themePickerCatalog : [{ ...themeContext.selectedTheme, source: "built-in" as const }]

  function applyOption(option: NonNullable<typeof state.themePickerCatalog>[number]) {
    themeContext.applyTheme(option)
    appState.closeThemePicker()
    toast.show(`Theme changed to ${option.name}.`)
  }

  return (
    <Show when={state.themePickerOpen}>
      <ModalFrame borderColor={theme.accent} width={72} centered>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>Change Theme</text>
          <text fg={theme.textSubtle}>current: {themeContext.selectedTheme.name}</text>
        </box>
        <Show when={state.themePickerMessage}>
          {(message) => <text fg={theme.warning}>{message()}</text>}
        </Show>
        <For each={options()}>
          {(option, index) => {
            const selected = () => index() === state.themePickerSelectedIndex
            return (
              <box height={3} paddingLeft={1} paddingRight={1} backgroundColor={selected() ? theme.selected : undefined} onMouseUp={() => applyOption(option)}>
                <box flexDirection="row" justifyContent="space-between">
                  <text attributes={TextAttributes.BOLD} fg={selected() ? theme.selectedText : theme.text}>{selected() ? "> " : "  "}{option.name} ({option.id})</text>
                  <text fg={selected() ? theme.selectedText : theme.textMuted}>{option.source}</text>
                </box>
                <text fg={selected() ? theme.selectedText : theme.textMuted}>accent {option.colors.accent}  background {option.colors.background}</text>
              </box>
            )
          }}
        </For>
        <text fg={theme.textSubtle}>j/k or arrows preview · enter apply and save · esc close</text>
      </ModalFrame>
    </Show>
  )
}

function iconModeLabel(mode: (typeof iconModes)[number]) {
  if (mode === "nerd") return "Nerd Font"
  if (mode === "unicode") return "Unicode"
  return "ASCII"
}

function HelpPopup() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const listHeight = () => Math.max(4, dimensions().height - 10)

  useBindings(() => ({
    commands: [
      { name: "help.scroll.down", run: () => scrollbox?.scrollBy(1) },
      { name: "help.scroll.up", run: () => scrollbox?.scrollBy(-1) },
      { name: "help.page.down", run: () => scrollbox?.scrollBy(1, "viewport") },
      { name: "help.page.up", run: () => scrollbox?.scrollBy(-1, "viewport") },
    ],
    bindings: state.helpOpen ? [
      { key: "j", cmd: "help.scroll.down", preventDefault: false },
      { key: "down", cmd: "help.scroll.down", preventDefault: false },
      { key: "k", cmd: "help.scroll.up", preventDefault: false },
      { key: "up", cmd: "help.scroll.up", preventDefault: false },
      { key: "d", cmd: "help.page.down", preventDefault: false },
      { key: "u", cmd: "help.page.up", preventDefault: false },
    ] : [],
  }))

  return (
    <Show when={state.helpOpen}>
      <ModalFrame borderColor={theme.accent} width={88} centered>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>Keyboard Help</text>
          <text fg={theme.textSubtle}>j/k scroll · d/u page · ?/Esc/q close</text>
        </box>
        <text fg={theme.textMuted}>Commands reflect the current lazyjira keyboard workflow.</text>
        <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} height={listHeight()} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
          <For each={[...routeHelpCommands(state.route), ...paletteCommandsForBoard(state.board)]}>
            {(command) => (
              <box height={2} flexDirection="column">
                <box flexDirection="row" gap={2}>
                  <text fg={theme.warning} width={16} wrapMode="none">{command.keys}</text>
                  <text attributes={TextAttributes.BOLD} fg={theme.text} wrapMode="none">{command.label}</text>
                </box>
                <text fg={theme.textMuted} wrapMode="none">{command.description}</text>
              </box>
            )}
          </For>
        </scrollbox>
      </ModalFrame>
    </Show>
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
  const icons = useIcons()
  const theme = useTheme()
  const issue = () => state.pendingDeleteIssueKey ? state.issues[state.pendingDeleteIssueKey] : undefined

  return (
    <Show when={issue()}>
      {(selectedIssue) => (
        <box borderStyle="rounded" borderColor={theme.danger} paddingLeft={1} paddingRight={1} marginLeft={1} marginRight={1} flexDirection="row" justifyContent="space-between">
          <text fg={theme.danger} wrapMode="none">{icons.catalog.action.delete} Delete {selectedIssue().key}: {selectedIssue().title}?</text>
          <text fg={theme.text} wrapMode="none">y stage delete · n/Esc cancel · w render · W write Jira</text>
        </box>
      )}
    </Show>
  )
}

function StagedDiscardPopup() {
  const appState = useAppState()
  const { state } = appState
  const icons = useIcons()
  const theme = useTheme()
  const changes = () => stagedChanges(state)
  useStagedDiscardKeyboard(appState)

  return (
    <Show when={state.stagedDiscardOpen}>
      <ModalFrame borderColor={theme.warning} width={84}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.warning}>{icons.catalog.exceptional.staged} Discard Staged Changes</text>
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
  const icons = useIcons()
  const theme = useTheme()
  const plan = () => planJiraWrites(state)
  const counts = () => writePlanCounts(plan())
  useRemoteApplyKeyboard(appState)

  return (
    <Show when={state.remoteApplyOpen}>
      <ModalFrame borderColor={theme.danger} width={86}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.danger}>{state.remoteApplyApplying ? icons.catalog.exceptional.loading : icons.catalog.action.apply} Apply To Jira</text>
          <text fg={theme.textSubtle}>{state.remoteApplyApplying ? "Applying Jira operations..." : state.remoteDeleteConfirmationArmed ? "W permanently deletes staged issues · esc/q cancel" : "W applies planned operations · esc/q cancel"}</text>
        </box>
        <text fg={theme.textMuted}>Review planned Jira operations before any remote mutation is enabled.</text>
        <Show when={plan().length} fallback={<text fg={theme.textMuted}>No staged writes. Edit a field and stage it before using W.</text>}>
          <text fg={theme.textSubtle}>{counts().planned} planned · {counts().blocked} blocked</text>
          <For each={plan()}>
            {(item) => <WritePlanRow item={item} />}
          </For>
        </Show>
        <text fg={state.remoteDeleteConfirmationArmed ? theme.danger : theme.warning} wrapMode="none">{icons.catalog.exceptional.warning} {state.remoteDeleteConfirmationArmed ? "Remote delete armed: press W again to confirm permanent deletion." : "Delete operations require a second W confirmation."}</text>
      </ModalFrame>
    </Show>
  )
}

function CommentComposerPopup() {
  const appState = useAppState()
  const { state } = appState
  const icons = useIcons()
  const theme = useTheme()
  let textarea: TextareaRenderable | undefined
  const issue = () => issueByKey(state, state.selectedIssueKey)

  createEffect(() => {
    if (!state.commentEditing) return
    setTimeout(() => textarea && !textarea.isDestroyed && textarea.focus(), 1)
  })

  return (
    <Show when={state.commentEditing && issue()}>
      {(selectedIssue) => (
        <ModalFrame borderColor={theme.accent} width={82}>
          <box flexDirection="row" justifyContent="space-between">
            <text attributes={TextAttributes.BOLD} fg={theme.accent}>{icons.catalog.exceptional.staged} Stage Jira Comment</text>
            <text fg={theme.textSubtle}>Ctrl-Enter stage · Esc cancel</text>
          </box>
          <text fg={theme.textMuted}>Comment for {selectedIssue().key}: {selectedIssue().title}</text>
          <textarea
            ref={(element: TextareaRenderable) => (textarea = element)}
            height={8}
            initialValue={state.commentEditValue}
            onContentChange={() => appState.updateCommentValue(textarea?.plainText ?? "")}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.accent}
            backgroundColor={theme.panel}
            focusedBackgroundColor={theme.panel}
          />
        </ModalFrame>
      )}
    </Show>
  )
}

function WritePlanRow(props: { item: JiraWritePlanItem }) {
  const icons = useIcons()
  const theme = useTheme()
  const color = () => props.item.status === "blocked" ? theme.danger : theme.accent

  return (
    <box flexDirection="column" gap={0}>
      <text fg={color()} wrapMode="none">
        {props.item.status === "blocked" ? icons.catalog.exceptional.error : icons.catalog.action.apply} {props.item.title}
      </text>
      <text fg={theme.textSubtle} wrapMode="none">{props.item.detail}</text>
      <Show when={props.item.method && props.item.endpoint}>
        <text fg={theme.textMuted} wrapMode="none">{props.item.method} {props.item.endpoint}</text>
      </Show>
      <Show when={props.item.payloadPreview}>
        {(preview) => <text fg={theme.textMuted} wrapMode="none">{preview()}</text>}
      </Show>
      <Show when={props.item.blocker}>
        {(blocker) => <text fg={theme.warning} wrapMode="none">Blocked: {blocker()}</text>}
      </Show>
    </box>
  )
}

function AuthOnboardingPopup() {
  const appState = useAppState()
  const { state } = appState
  const icons = useIcons()
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
          {(error) => <text fg={theme.danger} wrapMode="none">{icons.catalog.exceptional.error} {error()}</text>}
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
          <text fg={theme.textMuted}>{icons.catalog.exceptional.loading} Saving credentials...</text>
        </Show>
      </ModalFrame>
    </Show>
  )
}

function ProjectPickerPopup() {
  const appState = useAppState()
  const { state } = appState
  const icons = useIcons()
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
          <text attributes={TextAttributes.BOLD} fg={theme.accent}>{projectPickerIcon(icons.catalog, state)} {projectPickerTitle(state)}</text>
          <text fg={theme.textSubtle}>{projectPickerHint(state)}</text>
        </box>
        <text fg={theme.textMuted}>P switches saved workspaces instantly. Press a only when you want Jira discovery.</text>
        <Show when={state.runtimeEnv === "dev"}>
          <text fg={theme.warning}>Using dev runtime fixtures. New data-backed features need matching dev fixture data.</text>
        </Show>
        <Show when={state.projectPicker.mode === "remote-boards" && state.projectPicker.selectedProject}>
          {(project) => <text fg={theme.warning} wrapMode="none">Project: {project().key} {project().name} · choose the Scrum or Kanban board that defines this workspace</text>}
        </Show>
        <Show when={state.projectPicker.error}>
          {(error) => <text fg={theme.danger} wrapMode="none">{icons.catalog.exceptional.error} {error()}</text>}
        </Show>
        <Show when={state.projectPicker.loading || state.projectPicker.saving}>
          <text fg={theme.textMuted}>{icons.catalog.exceptional.loading} {state.projectPicker.saving ? "Saving workspace..." : "Loading from Jira..."}</text>
        </Show>
        <Show when={state.projectPicker.searchOpen || state.projectPicker.searchQuery} fallback={<text fg={theme.textSubtle}>{projectPickerCountText(state, rows().length, totalCount(), optionLabel())}</text>}>
          <box borderStyle="rounded" borderColor={state.projectPicker.searchOpen ? theme.borderActive : theme.border} paddingLeft={1} paddingRight={1} height={3} flexDirection="row" gap={1} alignItems="center">
            <text attributes={TextAttributes.BOLD} fg={theme.warning} wrapMode="none">{icons.catalog.action.search} {state.projectPicker.mode === "remote-projects" ? "Search Jira" : "Filter"}</text>
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
            <text fg={theme.textSubtle} wrapMode="none">{state.projectPicker.mode === "remote-projects" ? projectPageStatus(state) : `${rows().length}/${totalCount()}`}</text>
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
        if (appState.state.remoteApplyApplying) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
      if (event.name === "w" && event.shift) {
        event.preventDefault()
        event.stopPropagation()
        void appState.confirmRemoteIssueApply()
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
      if (event.name === "[" && appState.state.projectPicker.mode === "remote-projects") {
        event.preventDefault()
        event.stopPropagation()
        void appState.changeProjectPickerPage(-1)
        return
      }
      if (event.name === "]" && appState.state.projectPicker.mode === "remote-projects") {
        event.preventDefault()
        event.stopPropagation()
        void appState.changeProjectPickerPage(1)
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

function ModalFrame(props: { borderColor: string; width: number; centered?: boolean; children: JSX.Element }) {
  const dimensions = useTerminalDimensions()
  const theme = useTheme()
  const width = () => Math.min(props.width, Math.max(1, dimensions().width - 2))
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
      justifyContent={props.centered ? "center" : undefined}
      paddingTop={props.centered ? 0 : top()}
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
  if (change.kind === "rank") return `${change.issueKey} rank ${change.position} ${change.targetIssueKey}`
  const preview = change.value.replace(/\s+/g, " ").slice(0, 48)
  return `${change.issueKey} ${change.label} · ${preview}`
}

function routeIcon(catalog: SemanticIconCatalog, route: AppRoute) {
  if (route === "issue-detail") return catalog.route.issueDetail
  return catalog.route[route]
}

function paletteIcon(catalog: SemanticIconCatalog, icon: PaletteCommandIcon) {
  if (icon.group === "route") return catalog.route[icon.name]
  if (icon.group === "action") return catalog.action[icon.name]
  return catalog.exceptional[icon.name]
}

function projectPickerIcon(catalog: SemanticIconCatalog, state: AppState) {
  if (state.projectPicker.mode === "remote-projects") return catalog.action.create
  if (state.projectPicker.mode === "remote-boards") return catalog.route.board
  return catalog.route.workspace
}

export function footerItems(focusedPane: string, route: AppRoute, board: AppState["board"], stagedDiscardOpen: boolean, remoteApplyOpen: boolean, authOnboardingOpen: boolean, projectPickerMode?: AppState["projectPicker"]["mode"], hasParent = false, sectionFocus = false) {
  if (authOnboardingOpen) return ["prod setup", "Enter continue/save", "Esc skip setup"]
  if (projectPickerMode === "local") return ["workspace switcher", "/ filter local", "enter switch", "a choose Jira project", "esc/q close"]
  if (projectPickerMode === "remote-projects") return ["remote projects", "/ search Jira", "[/] page", "j/k choose", "enter choose", "r refresh", "h local"]
  if (projectPickerMode === "remote-boards") return ["remote boards", "/ filter", "j/k choose", "enter switch", "r refresh boards", "h projects"]
  if (remoteApplyOpen) return ["remote write review", "W apply to Jira", "esc/q close"]
  if (stagedDiscardOpen) return ["discard staged", "j/k choose", "space mark", "enter discard", "esc/q close"]
  if (focusedPane === "sidebar") return ["sidebar", "j/k choose", "enter/l open/toggle", "space filter", "P project", "R refresh", "q quit"]
  if (focusedPane === "inspector") return ["inspector", "j/k field", "e/enter edit", "ctrl-enter stage", "x delete", "X discard", "w render", "W Jira"]
  if (route === "issue-detail") return sectionFocus
    ? ["focus mode", "h/l section", "j/k item", "enter act", "esc exit"]
    : ["detail", "tab focus", ...(hasParent ? ["enter parent"] : []), "j/k scroll", "d/u page", "e body", "c comment", "r refresh"]
  if (route === "workspace") return ["workspace", "j/k choose", "d/u page", "enter open", "R refresh", "/ filter", "S Jira search", "W Jira"]
  if (route === "config") return ["config", "j/k choose", "d/u page", "h/l pane", "a add", "e rename", "c color", "R refresh", "W Jira"]
  if (route === "timeline") return ["timeline", "j/k row", "d/u half-page", "h/l pan", "[/] viewport", "space collapse", "z zoom", "t today", "enter detail", "L load more"]
  if (route === "list") return ["list", "j/k row", "g/G ends", "d/u half-page", "h/l columns", "enter detail", "/ filter", "L load more"]
  if (route === "board") return boardCapabilities(board).supportsSprints
    ? ["active sprints", "j/k card", "h/l column", "enter open/new", "p priority", "R refresh", "/ filter", "W Jira"]
    : ["board", "j/k row", "h/l column", "enter open/new", "p priority", "R refresh", "L load more", "W Jira"]
  if (route === "backlog") return boardCapabilities(board).supportsSprintBacklog
    ? ["backlog", "j/k row", "h/l group", "space collapse", "J/K rank", "m move", "L load more", "W Jira"]
    : ["backlog", "j/k row", "space collapse", "J/K rank", "L load more", "W Jira"]
  return [...sidebarRoutesForBoard(board).map((destination) => `${destination.shortcut} ${destination.shortLabel.toLowerCase()}`), "P project", ";/: commands", "q quit"]
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
  if (state.projectPicker.mode === "remote-projects") return state.projectPicker.remoteProjectPage?.total ?? 0
  const projectKey = state.projectPicker.selectedProject?.key
  return projectKey ? (state.projectPicker.remoteBoardsByProject[projectKey]?.length ?? 0) : 0
}

function projectPickerTitle(state: AppState) {
  if (state.projectPicker.mode === "local") return "Switch Workspace"
  if (state.projectPicker.mode === "remote-projects") return "Choose Jira Project"
  return "Choose Jira Board"
}

function projectPickerHint(state: AppState) {
  if (state.projectPicker.mode === "local") return "/ filter · j/k choose · enter switch · a choose Jira project · Esc close"
  if (state.projectPicker.mode === "remote-projects") return "/ search Jira · [/] page · j/k choose · enter choose · r refresh · h local"
  return "/ filter · j/k choose · enter switch · r refresh · h projects"
}

function projectPickerPlaceholder(state: AppState) {
  if (state.projectPicker.mode === "local") return "project, board, or type"
  if (state.projectPicker.mode === "remote-projects") return "project key or name"
  return "board name or type"
}

function projectPickerEmptyText(state: AppState) {
  if (state.projectPicker.searchQuery) return state.projectPicker.mode === "remote-projects" ? "No Jira projects matched this search. Edit it or press Esc." : "No matches. Edit the filter or press Esc."
  if (state.projectPicker.mode === "local") return "No saved workspaces yet. Press a to choose a Jira project."
  if (state.projectPicker.mode === "remote-projects") return "No projects loaded. Press r to retry."
  return "No boards loaded for this project. Press r to retry."
}

function projectPickerCountText(state: AppState, visible: number, total: number, label: string) {
  if (state.projectPicker.mode === "remote-projects") return `Press / to search Jira · ${projectPageStatus(state)}`
  return `Press / to filter · ${visible}/${total} ${label}`
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
