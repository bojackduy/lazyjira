import type { AppState, BacklogGroupBy, BoardGroupBy, BoardMode, IssueSummary, StatusDefinition } from "./app-state"
import { issueWithDraft } from "./issue-drafts"

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
  return state.sprints.find((sprint) => sprint.id === state.activeSprintId) ?? state.sprints[0]
}

export function allIssues(state: AppState) {
  return Object.values(state.issues).map((issue) => issueWithDraft(state, issue))
}

export function issueList(state: AppState) {
  return allIssues(state).filter((issue) => matchesQuickFilters(state, issue))
}

export function activeSprintIssues(state: AppState) {
  return issueList(state).filter((issue) => issue.sprintId === state.activeSprintId)
}

export function kanbanIssues(state: AppState) {
  return issueList(state).filter((issue) => state.statuses.some((status) => status.id === issue.statusId))
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
  const windowSize = boardStatusWindowSize(totalWidth, state.statuses.length)
  const maxOffset = Math.max(0, state.statuses.length - windowSize)
  const offset = Math.min(boardStatusOffsetForMode(state, mode), maxOffset)
  return state.statuses.slice(offset, offset + windowSize)
}

export function boardGroupsForMode(state: AppState, mode: BoardMode) {
  return groupIssues(boardIssuesForMode(state, mode), boardGroupByForMode(state, mode))
}

export function statusById(state: AppState, statusId: string): StatusDefinition | undefined {
  return state.statuses.find((status) => status.id === statusId)
}

export function issueTypeColor(state: AppState, issue: IssueSummary) {
  return state.issueTypes.find((type) => type.id === issue.type)?.color ?? "#94A3B8"
}

export function statusColor(state: AppState, issue: IssueSummary) {
  return statusById(state, issue.statusId)?.color ?? "#94A3B8"
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
  const issues = issueList(state)
  if (groupBy !== "sprint") return groupIssues(issues, groupBy)

  const groups: IssueGroup[] = []
  for (const sprint of state.sprints) {
    groups.push({
      id: sprint.id,
      label: `${sprint.name}${sprint.state === "active" ? " (active)" : ""}`,
      issueKeys: issues.filter((issue) => issue.sprintId === sprint.id).map((issue) => issue.key),
    })
  }
  groups.push({ id: "backlog", label: "Backlog", issueKeys: issues.filter((issue) => !issue.sprintId).map((issue) => issue.key) })
  return groups.filter((group) => group.issueKeys.length > 0)
}

export function nextBoardGroupBy(current: BoardGroupBy) {
  const index = boardGroupModes.findIndex((mode) => mode.id === current)
  return boardGroupModes[(index + 1) % boardGroupModes.length]?.id ?? "none"
}

export function nextBacklogGroupBy(current: BacklogGroupBy) {
  const index = backlogGroupModes.findIndex((mode) => mode.id === current)
  return backlogGroupModes[(index + 1) % backlogGroupModes.length]?.id ?? "sprint"
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
