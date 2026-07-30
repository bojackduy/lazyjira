import type { AppState, BacklogGroupBy, BoardGroupBy, BoardMode, IssueSummary, StatusDefinition } from "./app-state"
import { configuredIssueTypes, configuredStatuses } from "./config-drafts"
import { issueWithDraft } from "./issue-drafts"
import { matchesIssueSearch } from "./issue-search"
import { defaultIssueTypeColor, statusColorForCategory } from "./metadata-colors"
import { boardCapabilities } from "./routes"
import { backlogIssuePageSourceId, boardIssuePageSourceId, sprintIssuePageSourceId } from "./issue-pages"

export const boardGroupModes: { id: BoardGroupBy; label: string }[] = [
  { id: "none", label: "None" },
  { id: "feature", label: "Feature" },
  { id: "assignee", label: "Assignee" },
  { id: "epic", label: "Epic" },
  { id: "space", label: "Space" },
  { id: "issueType", label: "Issue Type" },
  { id: "priority", label: "Priority" },
]

export const backlogGroupModes: { id: BacklogGroupBy; label: string }[] = [
  { id: "sprint", label: "Sprint" },
  { id: "feature", label: "Feature" },
  { id: "assignee", label: "Assignee" },
  { id: "epic", label: "Epic" },
  { id: "space", label: "Space" },
  { id: "issueType", label: "Issue Type" },
  { id: "priority", label: "Priority" },
]

export type IssueGroup = {
  id: string
  label: string
  issueKeys: string[]
}

export function activeSprint(state: AppState) {
  return state.sprints.find((sprint) => sprint.id === state.activeSprintId && sprint.state === "active") ?? state.sprints.find((sprint) => sprint.state === "active")
}

export function allIssues(state: AppState) {
  return Object.values(state.issues).map((issue) => issueWithDraft(state, issue))
}

export function issueList(state: AppState) {
  return allIssues(state).filter((issue) => matchesQuickFilters(state, issue) && matchesIssueSearch(state, issue))
}

export function activeSprintIssues(state: AppState) {
  return issuesForSource(state, sprintIssuePageSourceId(state.activeSprintId)).filter((issue) => issue.sprintId === state.activeSprintId)
}

export function kanbanIssues(state: AppState) {
  return issuesForSource(state, boardIssuePageSourceId).filter((issue) => configuredStatuses(state).some((status) => status.id === issue.statusId))
}

export function boardIssuesForMode(state: AppState, mode: "active-sprint" | "kanban") {
  return mode === "active-sprint" ? activeSprintIssues(state) : kanbanIssues(state)
}

export function boardGroupByForMode(state: AppState, mode: BoardMode) {
  return mode === "active-sprint" ? state.activeSprintGroupBy : state.kanbanGroupBy
}

export function boardStatusOffsetForMode(state: AppState, mode: BoardMode) {
  return mode === "active-sprint" ? state.activeSprintStatusOffset : state.kanbanStatusOffset
}

export function boardStatusWindowSize(totalWidth: number, statusCount: number) {
  const reservedWidth = totalWidth < 100 ? 10 : 70
  const usableWidth = Math.max(20, totalWidth - reservedWidth)
  const columnWidth = 19
  const columnGap = 1
  const count = Math.floor((usableWidth + columnGap) / (columnWidth + columnGap))
  return Math.max(1, Math.min(statusCount, count))
}

export function visibleStatusesForBoard(state: AppState, mode: BoardMode, totalWidth: number) {
  const statuses = configuredStatuses(state)
  const windowSize = boardStatusWindowSize(totalWidth, statuses.length)
  const maxOffset = Math.max(0, statuses.length - windowSize)
  const offset = Math.min(boardStatusOffsetForMode(state, mode), maxOffset)
  return statuses.slice(offset, offset + windowSize)
}

export function boardGroupsForMode(state: AppState, mode: BoardMode) {
  return groupIssues(boardIssuesForMode(state, mode), boardGroupByForMode(state, mode))
}

export function statusById(state: AppState, statusId: string): StatusDefinition | undefined {
  return configuredStatuses(state).find((status) => status.id === statusId)
}

export function issueTypeColor(state: AppState, issue: IssueSummary) {
  return configuredIssueTypes(state).find((type) => type.id === issue.type || type.name === issue.type)?.color ?? defaultIssueTypeColor
}

export function issueTypeName(state: AppState, issue: IssueSummary) {
  return configuredIssueTypes(state).find((type) => type.id === issue.type || type.name === issue.type)?.name ?? issue.type
}

export function statusColor(state: AppState, issue: IssueSummary) {
  return statusById(state, issue.statusId)?.color ?? statusColorForCategory("todo")
}

export function statusName(state: AppState, issue: IssueSummary) {
  return statusById(state, issue.statusId)?.name ?? issue.statusId
}

export function matchesQuickFilters(state: AppState, issue: IssueSummary) {
  return state.activeQuickFilters.every((filter) => {
    switch (filter) {
      case "mine":
        return issue.assignee === state.currentUser
      case "blocked":
        return issue.blocked || issue.statusId === "blocked"
      case "stale":
        return issue.staleDays >= 7
      case "unassigned":
        return issue.assignee === "Unassigned"
    }
  })
}

export function groupIssues(issues: IssueSummary[], groupBy: BoardGroupBy): IssueGroup[] {
  if (groupBy === "none") return [{ id: "all", label: "All Work", issueKeys: issues.map((issue) => issue.key) }]

  const groups = new Map<string, IssueGroup>()
  for (const issue of issues) {
    const label = groupLabel(issue, groupBy)
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown"
    const group = groups.get(id) ?? { id, label, issueKeys: [] }
    group.issueKeys.push(issue.key)
    groups.set(id, group)
  }

  return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label))
}

export function groupBacklogIssues(state: AppState, groupBy: BacklogGroupBy): IssueGroup[] {
  if (!boardCapabilities(state.board).supportsSprintBacklog) {
    return [{ id: "backlog", label: "Board backlog", issueKeys: issuesForSource(state, backlogIssuePageSourceId).map((issue) => issue.key) }]
  }
  const issues = planningIssues(state)
  if (groupBy !== "sprint") return groupIssues(issues, groupBy)

  const groups: IssueGroup[] = []
  for (const sprint of state.sprints) {
    const issueKeys = issues.filter((issue) => issue.sprintId === sprint.id).map((issue) => issue.key)
    groups.push({
      id: sprint.id,
      label: `${sprint.state === "active" ? "Active" : "Future"} · ${sprint.name}${sprintDateRange(sprint.startDate, sprint.endDate)}`,
      issueKeys,
    })
  }
  groups.push({ id: "backlog", label: "Backlog", issueKeys: issues.filter((issue) => !issue.sprintId).map((issue) => issue.key) })
  return groups
}

export function issuesForSource(state: AppState, sourceId: string) {
  return (state.issueKeysBySource[sourceId] ?? [])
    .map((issueKey) => state.issues[issueKey])
    .filter((issue): issue is IssueSummary => !!issue)
    .map((issue) => issueWithDraft(state, issue))
    .filter((issue) => matchesQuickFilters(state, issue) && matchesIssueSearch(state, issue))
}

function planningIssues(state: AppState) {
  const keys = new Set<string>(state.issueKeysBySource[backlogIssuePageSourceId] ?? [])
  for (const sprint of state.sprints) {
    for (const issueKey of state.issueKeysBySource[sprintIssuePageSourceId(sprint.id)] ?? []) keys.add(issueKey)
  }
  return [...keys]
    .map((issueKey) => state.issues[issueKey])
    .filter((issue): issue is IssueSummary => !!issue)
    .map((issue) => issueWithDraft(state, issue))
    .filter((issue) => matchesQuickFilters(state, issue) && matchesIssueSearch(state, issue))
}

export function nextBoardGroupBy(current: BoardGroupBy) {
  const index = boardGroupModes.findIndex((mode) => mode.id === current)
  return boardGroupModes[(index + 1) % boardGroupModes.length]?.id ?? "none"
}

export function nextBacklogGroupBy(current: BacklogGroupBy) {
  const index = backlogGroupModes.findIndex((mode) => mode.id === current)
  return backlogGroupModes[(index + 1) % backlogGroupModes.length]?.id ?? "sprint"
}

export function backlogCreateSprintId(state: AppState) {
  if (!boardCapabilities(state.board).supportsSprintBacklog) return undefined
  return state.selectedBacklogGroupId === "backlog" ? undefined : state.sprints.find((sprint) => sprint.id === state.selectedBacklogGroupId)?.id
}

export function sprintDateRange(startDate: string | undefined, endDate: string | undefined) {
  if (!startDate && !endDate) return ""
  if (!startDate) return ` · ends ${shortDate(endDate!)}`
  if (!endDate) return ` · starts ${shortDate(startDate)}`
  return ` · ${shortDate(startDate)}-${shortDate(endDate)}`
}

export function emptyLoadedIssuesText(state: AppState, surface: string) {
  return state.activeQuickFilters.length || state.searchQuery.trim()
    ? `No loaded ${surface} match the active filters.`
    : `No ${surface} are loaded from Jira.`
}

export function groupModeLabel(groupBy: BoardGroupBy | BacklogGroupBy) {
  return [...boardGroupModes, ...backlogGroupModes].find((mode) => mode.id === groupBy)?.label ?? groupBy
}

function groupLabel(issue: IssueSummary, groupBy: Exclude<BoardGroupBy, "none">) {
  switch (groupBy) {
    case "assignee":
      return issue.assignee || "Unassigned"
    case "epic":
      return issue.epic || "No Epic"
    case "feature":
      return issue.feature || "No Feature"
    case "space":
      return issue.space || "No Space"
    case "issueType":
      return issue.type
    case "priority":
      return issue.priority
  }
}

function shortDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return `${match[2]}/${match[3]}`
}
