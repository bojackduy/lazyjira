import { TextAttributes, type InputRenderable, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useIcons } from "../context/icons"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { AppState, ConfigSectionId } from "../state/app-state"
import {
  colorableConfigSection,
  configuredColumns,
  configDraftSummary,
  configuredIssueTypes,
  configuredStatuses,
  writableConfigSection,
} from "../state/config-drafts"
import { issueFields } from "../state/issue-fields"
import { priorityColors } from "../state/metadata-colors"
import { routeBindingsBlocked } from "../state/keyboard-context"
import { allIssues } from "../state/selectors"

type ConfigRow = {
  id: string
  label: string
  detail: string
  color?: string
  capability?: string
}

type ConfigSection = {
  id: ConfigSectionId
  title: string
  subtitle: string
  remote: string
  rows: ConfigRow[]
}

export function ConfigRoute() {
  const appState = useAppState()
  const { state } = appState
  const icons = useIcons()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const compact = () => dimensions().width < 110
  const sections = () => configSections(state)
  const selectedSection = () => sections()[state.configSelectedSectionIndex] ?? sections()[0]!
  const sectionsFocused = () => state.focusedPane === "main" && state.configFocusedArea === "sections"
  const rowsFocused = () => state.focusedPane === "main" && state.configFocusedArea === "rows"

  useBindings(() => ({
    commands: [
      { name: "config.page.down", run: () => pageConfig(1) },
      { name: "config.page.up", run: () => pageConfig(-1) },
    ],
    bindings: state.route !== "config" || routeBindingsBlocked(state) ? [] : [
      { key: "d", cmd: "config.page.down", preventDefault: false },
      { key: { name: "d", ctrl: true }, cmd: "config.page.down" },
      { key: "u", cmd: "config.page.up", preventDefault: false },
      { key: { name: "u", ctrl: true }, cmd: "config.page.up" },
    ],
  }))

  function pageConfig(delta: 1 | -1) {
    if (state.route !== "config" || state.focusedPane !== "main" || state.remoteApplyOpen || state.stagedDiscardOpen || state.projectPicker.open || state.authOnboarding.open) return false
    if (state.configFocusedArea === "rows") {
      const visibleRows = Math.max(1, Math.floor(configRowsHeight(state, dimensions().height) / 3))
      appState.moveConfigSelection(delta * Math.max(1, Math.floor(visibleRows / 2)))
      return
    }
    appState.moveConfigSelection(delta * 3)
  }

  return (
    <box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <box height={compact() ? 5 : 4} flexShrink={0} flexDirection="column">
        <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">{icons.catalog.route.config} Metadata Config</text>
        <text fg={theme.textMuted} wrapMode="none">Inspect Jira metadata locally. Columns summarize board lanes; statuses show workflow details.</text>
        <text fg={theme.textSubtle} wrapMode="none">j/k choose · d/u page · h/l sections/rows · enter/e rename · w render · W Jira</text>
        <Show when={compact()}>
          <text fg={theme.textSubtle} wrapMode="none">a add · c color · x remove · X discard staged</text>
        </Show>
      </box>

      <box flexDirection={compact() ? "column" : "row"} gap={1} flexGrow={1} minHeight={0}>
        <box borderStyle="rounded" borderColor={sectionsFocused() ? theme.borderActive : theme.border} padding={1} width={compact() ? "100%" : 34} flexShrink={0} flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD} fg={theme.warning}>Sections</text>
          <For each={sections()}>
            {(section, index) => {
              const selected = () => state.configSelectedSectionIndex === index()
              const writable = () => writableConfigSection(section.id)
              return (
                <box height={3} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={selected() && sectionsFocused() ? theme.selected : undefined} flexDirection="column">
                  <text fg={selected() && sectionsFocused() ? theme.selectedText : selected() ? theme.accent : theme.text} wrapMode="none">{selected() ? ">" : " "} {section.title}</text>
                  <text fg={selected() && sectionsFocused() ? theme.selectedText : writable() ? theme.textMuted : theme.textSubtle} wrapMode="none">{section.subtitle}</text>
                </box>
              )
            }}
          </For>
        </box>

        <box borderStyle="rounded" borderColor={rowsFocused() ? theme.borderActive : theme.border} padding={1} flexGrow={1} minWidth={0} minHeight={0} flexDirection="column" gap={1}>
          <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
            <text attributes={TextAttributes.BOLD} fg={theme.text} wrapMode="none">{selectedSection().title}</text>
            <text fg={theme.textSubtle} wrapMode="none">Remote: {selectedSection().remote}</text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">{selectedSection().subtitle}</text>
          <text fg={writableConfigSection(selectedSection().id) ? theme.warning : theme.textSubtle} wrapMode="none">{sectionHint(state, selectedSection().id)}</text>
          <ConfigRows section={selectedSection()} focused={rowsFocused()} />
          <ConfigEditor />
          <ConfigDraftList />
        </box>
      </box>
    </box>
  )
}

function ConfigRows(props: { section: ConfigSection; focused: boolean }) {
  const { state } = useAppState()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const height = () => configRowsHeight(state, dimensions().height)

  createEffect(() => {
    if (state.route !== "config" || state.configFocusedArea !== "rows") return
    scrollbox?.scrollChildIntoView(configRowElementId(props.section.id, state.configSelectedRowIndex))
  })

  return (
    <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} width="100%" height={height()} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
      <For each={props.section.rows} fallback={<text fg={theme.textSubtle}>No metadata rows</text>}>
        {(row, index) => <ConfigRowView row={row} index={index()} sectionId={props.section.id} focused={props.focused} />}
      </For>
    </scrollbox>
  )
}

function ConfigRowView(props: { row: ConfigRow; index: number; sectionId: ConfigSectionId; focused: boolean }) {
  const icons = useIcons()
  const { theme } = useTheme()
  const { state } = useAppState()
  const selected = () => state.configFocusedArea === "rows" && state.configSelectedRowIndex === props.index
  const staged = () => state.configDrafts.some((draft) => draft.sectionId === props.sectionId && draft.targetId === props.row.id)
  return (
    <box id={configRowElementId(props.sectionId, props.index)} height={3} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={selected() && props.focused ? theme.selected : undefined} flexDirection="column">
      <text fg={selected() && props.focused ? theme.selectedText : props.row.color ?? theme.text} wrapMode="none">
        {selected() ? icons.catalog.structural.selection : " "} {configRowIcon(icons, props.sectionId, props.row)} {props.row.label}{staged() ? ` ${icons.catalog.exceptional.staged}` : ""}
      </text>
      <text fg={selected() && props.focused ? theme.selectedText : theme.textMuted} wrapMode="none">
        {props.row.detail}{props.row.capability ? ` · ${props.row.capability}` : ""}
      </text>
    </box>
  )
}

function configRowIcon(icons: ReturnType<typeof useIcons>, sectionId: ConfigSectionId, row: ConfigRow) {
  if (sectionId === "issue-types") return icons.issueType({ name: row.label })
  if (sectionId === "statuses") return icons.status({ name: row.label })
  if (sectionId === "priorities") return icons.priority(row.label)
  if (sectionId === "columns") return icons.catalog.route.board
  return icons.catalog.structural.leaf
}

function ConfigEditor() {
  const appState = useAppState()
  const { state } = appState
  const icons = useIcons()
  const { theme } = useTheme()
  const editing = () => state.configEditing
  return (
    <Show when={editing()}>
      {(current) => (
        <box border={['top']} borderColor={theme.border} paddingTop={1} flexDirection="column" gap={1} flexShrink={0}>
          <text attributes={TextAttributes.BOLD} fg={theme.warning} wrapMode="none">{current().action === "add" ? icons.catalog.action.create : icons.catalog.action.edit} {editTitle(current().action, current().sectionId)}</text>
          <input
            value={state.configEditValue}
            onInput={(value) => appState.updateConfigEditValue(value)}
            onSubmit={() => appState.commitConfigEdit()}
            ref={(element: InputRenderable) => setTimeout(() => !element.isDestroyed && element.focus(), 1)}
            placeholder={current().action === "color" ? "#RRGGBB" : "Name"}
            placeholderColor={theme.textSubtle}
            textColor={theme.text}
            focusedTextColor={theme.text}
            cursorColor={theme.accent}
            backgroundColor={theme.panel}
            focusedBackgroundColor={theme.panel}
          />
          <text fg={theme.textSubtle} wrapMode="none">Enter stage · Esc cancel · w applies after staging</text>
        </box>
      )}
    </Show>
  )
}

function ConfigDraftList() {
  const { state } = useAppState()
  const icons = useIcons()
  const { theme } = useTheme()
  return (
    <box border={['top']} borderColor={theme.border} paddingTop={1} flexDirection="column" gap={1} flexShrink={0}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.warning}>{icons.catalog.exceptional.staged} Staged Config</text>
        <text fg={state.configDrafts.length ? theme.warning : theme.textSubtle}>{state.configDrafts.length} staged</text>
      </box>
      <For each={state.configDrafts} fallback={<text fg={theme.textSubtle}>No config changes staged.</text>}>
        {(draft) => <text fg={draft.action === "remove" ? theme.danger : theme.text} wrapMode="none">{configDraftSummary(draft)}</text>}
      </For>
    </box>
  )
}

function configSections(state: AppState): ConfigSection[] {
  const issues = allIssues(state)
  const columns = configuredColumns(state)
  const statuses = configuredStatuses(state)
  const issueTypes = configuredIssueTypes(state)
  const priorityCounts = ["Critical", "High", "Medium", "Low"].map((priority) => ({
    priority,
    count: issues.filter((issue) => issue.priority === priority).length,
  }))

  return [
    {
      id: "columns",
      title: "Board Columns",
      subtitle: `${columns.length} board columns`,
      remote: "board admin later",
      rows: columns.map((column) => ({
        id: column.id,
        label: column.name,
        detail: columnDetail(column, statuses, issues),
        color: column.color ?? firstColumnStatus(column, statuses)?.color,
        capability: state.runtimeEnv === "prod" ? "color from Jira" : "local add/rename/color/remove",
      })),
    },
    {
      id: "statuses",
      title: "Statuses",
      subtitle: "Workflow states and categories",
      remote: "admin/workflow scoped",
      rows: statuses.map((status) => ({
        id: status.id,
        label: status.name,
        detail: `${containingColumnName(columns, status.id)} · ${status.category} · ${issues.filter((issue) => issue.statusId === status.id).length} issues · id ${status.id}`,
        color: status.color,
        capability: state.runtimeEnv === "prod" ? "color from Jira status category" : "local add/rename/color/remove",
      })),
    },
    {
      id: "issue-types",
      title: "Issue Types",
      subtitle: `${issueTypes.length} issue types`,
      remote: "admin/scheme scoped",
      rows: issueTypes.map((issueType) => ({
        id: issueType.id,
        label: issueType.name,
        detail: `${issues.filter((issue) => issue.type === issueType.id).length} issues · color ${issueType.color}`,
        color: issueType.color,
        capability: state.runtimeEnv === "prod" ? "color from Jira icon" : "local add/rename/color/remove",
      })),
    },
    {
      id: "priorities",
      title: "Priorities",
      subtitle: "Priority values used by visible issues",
      remote: "admin scoped",
      rows: priorityCounts.map(({ priority, count }) => ({
        id: priority,
        label: priority,
        detail: `${count} issues`,
        color: issues.find((issue) => issue.priority === priority)?.priorityColor ?? priorityColor(priority),
        capability: "read-only until priority model exists",
      })),
    },
    {
      id: "fields",
      title: "Fields",
      subtitle: `${issueFields.length} supported inspector fields`,
      remote: "read-only mapping first",
      rows: issueFields.map((field) => ({
        id: field.id,
        label: field.label,
        detail: field.editable ? "editable in app" : "read-only in app",
        capability: field.editable ? "Jira field mapping later" : "display only",
      })),
    },
    {
      id: "quick-filters",
      title: "Quick Filters",
      subtitle: `${state.quickFilters.length} workspace filters`,
      remote: "board filter later",
      rows: state.quickFilters.map((filter) => ({
        id: filter.id,
        label: filter.label,
        detail: state.activeQuickFilters.includes(filter.id) ? "active" : "inactive",
        capability: quickFilterDescription(state, filter.id),
      })),
    },
  ]
}

function sectionHint(state: AppState, sectionId: ConfigSectionId) {
  if (!writableConfigSection(sectionId)) return "Read-only for now. j/k choose · d/u page; edits wait for real model/API support."
  if (state.runtimeEnv === "prod") return "Jira metadata is authoritative · j/k choose · d/u page"
  return colorableConfigSection(state, sectionId)
    ? "j/k choose · d/u page · a add · e/enter rename · c color · x remove · X discard"
    : "j/k choose · d/u page · a add · e/enter rename · x remove · X discard"
}

function editTitle(action: string, sectionId: ConfigSectionId) {
  const target = sectionId === "issue-types" ? "issue type" : sectionId === "columns" ? "column" : "status"
  if (action === "add") return `Add ${target}`
  if (action === "color") return `Set ${target} color`
  return `Rename ${target}`
}

function priorityColor(priority: string) {
  return priorityColors[priority as keyof typeof priorityColors] ?? priorityColors.Medium
}

function quickFilterDescription(state: AppState, filterId: string) {
  switch (filterId) {
    case "mine":
      return "assignee = currentUser()"
    case "blocked":
      return "blocked flag or Blocked status"
    case "stale":
      return "stale >= 7 days"
    case "unassigned":
      return "assignee is Unassigned"
    default:
      return filterId
  }
}

function configRowElementId(sectionId: ConfigSectionId, index: number) {
  return `config-row-${sectionId}-${index}`
}

function configRowsHeight(state: AppState, terminalHeight: number) {
  return Math.max(4, terminalHeight - (state.configEditing ? 26 : 21))
}

function columnDetail(column: ReturnType<typeof configuredColumns>[number], statuses: ReturnType<typeof configuredStatuses>, issues: ReturnType<typeof allIssues>) {
  const statusIds = column.statusIds ?? []
  const statusNames = statusIds.flatMap((statusId) => statuses.find((status) => status.id === statusId)?.name ?? [])
  const issueCount = statusIds.length
    ? issues.filter((issue) => statusIds.includes(issue.statusId)).length
    : column.issueKeys.length
  const statusText = statusNames.length ? `${statusNames.length} statuses: ${statusNames.join(", ")}` : "No mapped statuses"
  return `${statusText} · ${issueCount} issues · id ${column.id}`
}

function containingColumnName(columns: ReturnType<typeof configuredColumns>, statusId: string) {
  return columns.find((column) => column.statusIds?.includes(statusId))?.name ?? "Unmapped column"
}

function firstColumnStatus(column: ReturnType<typeof configuredColumns>[number], statuses: ReturnType<typeof configuredStatuses>) {
  return statuses.find((status) => column.statusIds?.includes(status.id))
}
