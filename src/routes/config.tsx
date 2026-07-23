import { TextAttributes, type InputRenderable, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"
import type { AppState, ConfigSectionId } from "../state/app-state"
import {
  colorableConfigSection,
  configDraftSummary,
  configuredIssueTypes,
  configuredStatuses,
  writableConfigSection,
} from "../state/config-drafts"
import { issueFields } from "../state/issue-fields"
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
  const { state } = useAppState()
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  const compact = () => dimensions().width < 110
  const sections = () => configSections(state)
  const selectedSection = () => sections()[state.configSelectedSectionIndex] ?? sections()[0]!
  const sectionsFocused = () => state.focusedPane === "main" && state.configFocusedArea === "sections"
  const rowsFocused = () => state.focusedPane === "main" && state.configFocusedArea === "rows"

  return (
    <box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <box height={4} flexShrink={0} flexDirection="column">
        <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">Metadata Config</text>
        <text fg={theme.textMuted} wrapMode="none">Local dev metadata overlay. Board Columns, Statuses, and Issue Types are writable first.</text>
        <text fg={theme.textSubtle} wrapMode="none">j/k choose · h/l sections/rows · a add · e rename · c color · x remove · w render · X discard · W Jira</text>
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
          <text fg={writableConfigSection(selectedSection().id) ? theme.warning : theme.textSubtle} wrapMode="none">{sectionHint(selectedSection().id)}</text>
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
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const height = () => Math.max(4, dimensions().height - (state.configEditing ? 26 : 21))

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
  const theme = useTheme()
  const { state } = useAppState()
  const selected = () => state.configFocusedArea === "rows" && state.configSelectedRowIndex === props.index
  const staged = () => state.configDrafts.some((draft) => draft.sectionId === props.sectionId && draft.targetId === props.row.id)
  return (
    <box id={configRowElementId(props.sectionId, props.index)} height={3} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={selected() && props.focused ? theme.selected : undefined} flexDirection="column">
      <text fg={selected() && props.focused ? theme.selectedText : props.row.color ?? theme.text} wrapMode="none">
        {selected() ? ">" : " "} {props.row.color ? "● " : ""}{props.row.label}{staged() ? " *" : ""}
      </text>
      <text fg={selected() && props.focused ? theme.selectedText : theme.textMuted} wrapMode="none">
        {props.row.detail}{props.row.capability ? ` · ${props.row.capability}` : ""}
      </text>
    </box>
  )
}

function ConfigEditor() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const editing = () => state.configEditing
  return (
    <Show when={editing()}>
      {(current) => (
        <box border={['top']} borderColor={theme.border} paddingTop={1} flexDirection="column" gap={1} flexShrink={0}>
          <text attributes={TextAttributes.BOLD} fg={theme.warning} wrapMode="none">{editTitle(current().action, current().sectionId)}</text>
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
  const theme = useTheme()
  return (
    <box border={['top']} borderColor={theme.border} paddingTop={1} flexDirection="column" gap={1} flexShrink={0}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.warning}>Staged Config</text>
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
      subtitle: `${statuses.length} workflow columns`,
      remote: "board admin later",
      rows: statuses.map((status) => ({
        id: status.id,
        label: status.name,
        detail: `${status.category} · ${issues.filter((issue) => issue.statusId === status.id).length} issues · id ${status.id}`,
        color: status.color,
        capability: "local add/rename/color/remove",
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
        detail: `${status.category} · color ${status.color} · id ${status.id}`,
        color: status.color,
        capability: "local add/rename/color/remove",
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
        capability: "local add/rename/color/remove",
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
        color: priorityColor(priority),
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

function sectionHint(sectionId: ConfigSectionId) {
  if (!writableConfigSection(sectionId)) return "Read-only for now. This stays inert until the model/API support is real."
  return colorableConfigSection(sectionId)
    ? "a add · e/enter rename · c color · x remove · X discard staged"
    : "a add · e/enter rename · x remove · X discard staged"
}

function editTitle(action: string, sectionId: ConfigSectionId) {
  const target = sectionId === "issue-types" ? "issue type" : sectionId === "columns" ? "column" : "status"
  if (action === "add") return `Add ${target}`
  if (action === "color") return `Set ${target} color`
  return `Rename ${target}`
}

function priorityColor(priority: string) {
  if (priority === "Critical") return "#EF4444"
  if (priority === "High") return "#F97316"
  if (priority === "Medium") return "#F59E0B"
  return "#22C55E"
}

function quickFilterDescription(state: AppState, filterId: string) {
  switch (filterId) {
    case "mine":
      return `assignee = ${state.currentUser}`
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
