import { TextAttributes } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { For } from "solid-js"
import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"
import type { AppState } from "../state/app-state"
import { issueFields } from "../state/issue-fields"
import { allIssues, statusById } from "../state/selectors"

type ConfigRow = {
  label: string
  detail: string
  color?: string
  capability?: string
}

type ConfigSection = {
  id: string
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
  const focused = () => state.focusedPane === "main"

  return (
    <box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <box height={3} flexShrink={0} flexDirection="column">
        <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">Metadata Config</text>
        <text fg={theme.textMuted} wrapMode="none">Read-only project and board metadata. Local/remote edits come after this model is stable.</text>
        <text fg={theme.textSubtle} wrapMode="none">j/k section · W future Jira write review · X future staged discard</text>
      </box>

      <box flexDirection={compact() ? "column" : "row"} gap={1} flexGrow={1} minHeight={0}>
        <box borderStyle="rounded" borderColor={focused() ? theme.borderActive : theme.border} padding={1} width={compact() ? "100%" : 34} flexShrink={0} flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD} fg={theme.warning}>Sections</text>
          <For each={sections()}>
            {(section, index) => {
              const selected = () => state.configSelectedSectionIndex === index()
              return (
                <box height={3} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={selected() ? theme.selected : undefined} flexDirection="column">
                  <text fg={selected() ? theme.selectedText : theme.text} wrapMode="none">{selected() ? ">" : " "} {section.title}</text>
                  <text fg={selected() ? theme.selectedText : theme.textMuted} wrapMode="none">{section.subtitle}</text>
                </box>
              )
            }}
          </For>
        </box>

        <box borderStyle="rounded" borderColor={theme.border} padding={1} flexGrow={1} minWidth={0} minHeight={0} flexDirection="column" gap={1}>
          <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
            <text attributes={TextAttributes.BOLD} fg={theme.text} wrapMode="none">{selectedSection().title}</text>
            <text fg={theme.textSubtle} wrapMode="none">Remote: {selectedSection().remote}</text>
          </box>
          <text fg={theme.textMuted} wrapMode="none">{selectedSection().subtitle}</text>
          <For each={selectedSection().rows} fallback={<text fg={theme.textSubtle}>No metadata rows</text>}>
            {(row) => <ConfigRowView row={row} />}
          </For>
        </box>
      </box>
    </box>
  )
}

function ConfigRowView(props: { row: ConfigRow }) {
  const theme = useTheme()
  return (
    <box height={3} flexShrink={0} paddingLeft={1} paddingRight={1} flexDirection="column">
      <text fg={props.row.color ?? theme.text} wrapMode="none">{props.row.color ? "● " : ""}{props.row.label}</text>
      <text fg={theme.textMuted} wrapMode="none">{props.row.detail}{props.row.capability ? ` · ${props.row.capability}` : ""}</text>
    </box>
  )
}

function configSections(state: AppState): ConfigSection[] {
  const issues = allIssues(state)
  const priorityCounts = ["Critical", "High", "Medium", "Low"].map((priority) => ({
    priority,
    count: issues.filter((issue) => issue.priority === priority).length,
  }))

  return [
    {
      id: "columns",
      title: "Board Columns",
      subtitle: `${state.statuses.length} workflow columns`,
      remote: "board admin later",
      rows: state.statuses.map((status) => ({
        label: status.name,
        detail: `${status.category} · ${issues.filter((issue) => issue.statusId === status.id).length} issues · id ${status.id}`,
        color: status.color,
        capability: "rename/reorder/add later",
      })),
    },
    {
      id: "statuses",
      title: "Statuses",
      subtitle: "Workflow states and categories",
      remote: "admin/workflow scoped",
      rows: state.statuses.map((status) => ({
        label: status.name,
        detail: `${status.category} · color ${status.color} · id ${status.id}`,
        color: status.color,
        capability: "local color/name first",
      })),
    },
    {
      id: "issue-types",
      title: "Issue Types",
      subtitle: `${state.issueTypes.length} issue types`,
      remote: "admin/scheme scoped",
      rows: state.issueTypes.map((issueType) => ({
        label: issueType.name,
        detail: `${issues.filter((issue) => issue.type === issueType.id).length} issues · color ${issueType.color}`,
        color: issueType.color,
        capability: "local color/name first",
      })),
    },
    {
      id: "priorities",
      title: "Priorities",
      subtitle: "Priority values used by visible issues",
      remote: "admin scoped",
      rows: priorityCounts.map(({ priority, count }) => ({
        label: priority,
        detail: `${count} issues`,
        color: priorityColor(priority),
        capability: "order/color later",
      })),
    },
    {
      id: "fields",
      title: "Fields",
      subtitle: `${issueFields.length} supported inspector fields`,
      remote: "read-only mapping first",
      rows: issueFields.map((field) => ({
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
        label: filter.label,
        detail: state.activeQuickFilters.includes(filter.id) ? "active" : "inactive",
        capability: quickFilterDescription(state, filter.id),
      })),
    },
  ]
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
