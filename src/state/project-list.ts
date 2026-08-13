import type { AppState, IssueSummary } from "./app-state"
import { issuePageActionVisible, projectListIssuePageSourceId } from "./issue-pages"
import { issuesForSource } from "./selectors"
import { projectTimelineRows, timelineModel } from "./timeline"

export type ProjectListColumnId = "key" | "summary" | "type" | "status" | "assignee" | "priority" | "parent" | "due" | "sprint" | "updated"

export type ProjectListColumn = {
  id: ProjectListColumnId
  label: string
  width: number
}

export const projectListLoadMoreRowKey = "__project-list-load-more__"

const fixedColumns: ProjectListColumn[] = [
  { id: "key", label: "Key", width: 12 },
  { id: "summary", label: "Summary", width: 34 },
]

const optionalColumns: ProjectListColumn[] = [
  { id: "type", label: "Type", width: 10 },
  { id: "status", label: "Status", width: 14 },
  { id: "assignee", label: "Assignee", width: 14 },
  { id: "priority", label: "Pri", width: 9 },
  { id: "due", label: "Due", width: 11 },
  { id: "parent", label: "Parent", width: 12 },
  { id: "sprint", label: "Sprint", width: 14 },
  { id: "updated", label: "Updated", width: 11 },
]

export function projectListIssues(state: AppState) {
  return projectListRows(state).map((row) => row.issue)
}

export function projectListRows(state: AppState) {
  if (!issuesForSource(state, projectListIssuePageSourceId).length) return []
  return projectTimelineRows(timelineModel(state).rows, state.collapsedProjectListParentKeys)
}

export function projectListColumns(width: number, horizontalOffset = 0) {
  const optionalCount = width >= 150 ? 8 : width >= 135 ? 7 : width >= 120 ? 6 : width >= 105 ? 5 : width >= 90 ? 4 : width >= 75 ? 2 : 0
  const maxOffset = Math.max(0, optionalColumns.length - optionalCount)
  const offset = Math.max(0, Math.min(horizontalOffset, maxOffset))
  return [...fixedColumns, ...optionalColumns.slice(offset, offset + optionalCount)]
}

export function projectListMaxHorizontalOffset(width: number) {
  return Math.max(0, optionalColumns.length - (projectListColumns(width).length - fixedColumns.length))
}

export function projectListViewportWidth(terminalWidth: number) {
  return Math.max(40, terminalWidth < 100 ? terminalWidth - 4 : terminalWidth - 70)
}

export function projectListSelection(keys: string[], selectedKey: string | undefined, delta: number | "first" | "last") {
  if (!keys.length) return undefined
  if (delta === "first") return keys[0]
  if (delta === "last") return keys.at(-1)
  const current = Math.max(0, keys.indexOf(selectedKey ?? ""))
  return keys[Math.max(0, Math.min(keys.length - 1, current + delta))]
}

export function projectListSelectionKeys(state: AppState) {
  const keys = projectListIssues(state).map((issue) => issue.key)
  return issuePageActionVisible(state.issuePageStateBySource[projectListIssuePageSourceId]) ? [...keys, projectListLoadMoreRowKey] : keys
}

export function projectListStateText(state: AppState) {
  const page = state.issuePageStateBySource[projectListIssuePageSourceId]
  const loaded = state.issueKeysBySource[projectListIssuePageSourceId]?.length ?? 0
  const visible = projectListIssues(state).length
  if (!page) return `Loading ${state.project.key} project issues...`
  if (page.loading && !loaded) return `Loading ${state.project.key} project issues...`
  if (page.error && !loaded && /Jira 403|permission|access denied/i.test(page.error)) return `Project List for ${state.project.key} requires Browse Projects and issue access. ${page.error}`
  if (page.error && !loaded) return `Project List for ${state.project.key} failed: ${page.error}`
  if (page.refreshing) return `Refreshing project issues · ${loaded}${typeof page.total === "number" ? `/${page.total}` : ""} retained...`
  if (page.loading) return `Loading more project issues · ${loaded}${typeof page.total === "number" ? `/${page.total}` : ""} retained...`
  if (page.error) return `Project List append failed; ${loaded} rows retained · L retry: ${page.error}`
  if (!visible && loaded) return `No loaded project issues match the active filters. Only ${loaded} loaded Jira issues were searched; press S to search all Jira.`
  if (!loaded && page.isLast) return `Jira returned no issues for project ${state.project.key}.`
  const count = `${loaded}${typeof page.total === "number" ? `/${page.total}` : ""}`
  return page.isLast ? `${count} project issues loaded` : `${count} project issues loaded · auto-loads more`
}

export function projectListCell(issue: IssueSummary, column: ProjectListColumnId, state: AppState) {
  if (column === "key") return issue.key
  if (column === "summary") return issue.title
  if (column === "type") return state.issueTypes.find((type) => type.id === issue.type || type.name === issue.type || type.name === issue.typeName)?.name ?? issue.typeName ?? issue.type
  if (column === "status") return state.statuses.find((status) => status.id === issue.statusId)?.name ?? issue.statusId
  if (column === "assignee") return issue.assignee
  if (column === "priority") return issue.priority
  if (column === "parent") return issue.parentKey ?? "-"
  if (column === "due") return issue.dueDate?.slice(0, 10) || "-"
  if (column === "sprint") return state.sprints.find((sprint) => sprint.id === issue.sprintId)?.name ?? "-"
  return issue.updatedAt?.slice(0, 10) || "-"
}
