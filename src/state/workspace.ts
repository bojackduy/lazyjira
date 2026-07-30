import type { AppRoute } from "./routes"
import type { AppState, IssueSummary } from "./app-state"
import { effectiveIssueSearchQuery } from "./issue-search"
import { loadedIssueCount } from "./issue-pages"
import { allIssues, activeSprint, groupModeLabel, isAssignedToCurrentUser, issueList, statusName } from "./selectors"
import { stagedChanges } from "./staged-changes"
import { boardCapabilities } from "./routes"

export type WorkspaceItem = {
  id: string
  section: "jump" | "attention" | "pending" | "search" | "recent"
  title: string
  subtitle: string
  count?: number
  route?: AppRoute
  issueKey?: string
  issueKeys?: string[]
}

export type WorkspaceResult = {
  id: string
  kind: "issue" | "change"
  title: string
  subtitle: string
  issueKey?: string
}

export function workspaceItems(state: AppState): WorkspaceItem[] {
  return [
    ...workspaceJumpTargets(state),
    workspacePendingItem(state),
    ...workspaceSearchItems(state),
    ...workspaceAttentionQueues(state),
    ...workspaceRecentItems(state),
  ]
}

export function workspaceJumpTargets(state: AppState): WorkspaceItem[] {
  const issues = allIssues(state)
  const sprint = activeSprint(state)
  const activeSprintIssues = issues.filter((issue) => issue.sprintId === state.activeSprintId)
  const backlogIssues = issues.filter((issue) => issue.sprintId !== state.activeSprintId)
  const myIssues = issues.filter((issue) => isAssignedToCurrentUser(state, issue))
  const board = boardCapabilities(state.board)

  return [
    {
      id: "jump:board",
      section: "jump",
      title: board.projectBoardLabel,
      subtitle: board.supportsSprints
        ? `${sprint?.name ?? "No active sprint"} · ${activeSprintIssues.length} issues · ${blockedIssues(activeSprintIssues).length} blocked`
        : `Grouped by ${groupModeLabel(state.kanbanGroupBy)} · ${issues.length} issues`,
      count: board.supportsSprints ? activeSprintIssues.length : issues.length,
      route: "board",
    },
    {
      id: "jump:backlog",
      section: "jump",
      title: "Backlog",
      subtitle: `${backlogIssues.length} issues · ${missingEstimateIssues(backlogIssues).length} need estimate`,
      count: backlogIssues.length,
      route: "backlog",
    },
    {
      id: "jump:my-work",
      section: "jump",
      title: "My Work",
      subtitle: `Assigned to ${state.currentUser} · ${myIssues.length} issues · ${staleIssues(myIssues).length} stale`,
      count: myIssues.length,
      issueKeys: myIssues.map((issue) => issue.key),
    },
  ]
}

export function workspacePendingItem(state: AppState): WorkspaceItem {
  const changes = stagedChanges(state)
  const editCount = changes.filter((change) => change.kind === "edit").length
  const deleteCount = changes.filter((change) => change.kind === "delete").length
  const configCount = changes.filter((change) => change.kind === "config").length
  const parts = [countLabel(editCount, "edit"), countLabel(deleteCount, "delete")]
  if (configCount) parts.push(countLabel(configCount, "config"))
  return {
    id: "pending:staged",
    section: "pending",
    title: "Pending Local",
    subtitle: changes.length ? `${parts.join(" · ")} · X discard · W write Jira` : "No staged edits or deletes",
    count: changes.length,
  }
}

export function workspaceSearchItems(state: AppState): WorkspaceItem[] {
  const items: WorkspaceItem[] = []
  const query = effectiveIssueSearchQuery(state).trim()
  if (query) {
    const issues = issueList(state)
    items.push({
      id: "search:loaded",
      section: "search",
      title: "Filtered Loaded",
      subtitle: `${issues.length}/${allIssues(state).length} loaded issues · ${query}`,
      count: issues.length,
      issueKeys: issues.map((issue) => issue.key),
    })
  }
  if (state.remoteSearchQuery || state.remoteSearchIssueKeys.length || state.remoteSearchPageState.loading || state.remoteSearchPageState.error) {
    items.push({
      id: "search:remote",
      section: "search",
      title: "Remote Jira Search",
      subtitle: remoteSearchSubtitle(state),
      count: state.remoteSearchIssueKeys.length,
      issueKeys: state.remoteSearchIssueKeys,
    })
  }
  return items
}

function remoteSearchSubtitle(state: AppState) {
  const page = state.remoteSearchPageState
  const total = typeof page.total === "number" ? `/${page.total}` : ""
  const suffix = page.loading ? " · loading" : page.error ? ` · ${page.error}` : page.isLast ? "" : " · L more"
  return `${loadedIssueCount(page)}${total} Jira results · ${state.remoteSearchQuery || "empty"}${suffix}`
}

export function workspaceAttentionQueues(state: AppState): WorkspaceItem[] {
  const issues = allIssues(state)
  return [
    queueItem("blocked", "Blocked", "Blocked flag or Blocked workflow status", blockedIssues(issues)),
    queueItem("stale", "Stale > 7d", "No update for at least 7 days", staleIssues(issues)),
    queueItem("unassigned", "Unassigned", "No owner assigned", issues.filter((issue) => issue.assignee === "Unassigned")),
    queueItem("no-sprint", "No Sprint", "Not planned into any sprint", issues.filter((issue) => !issue.sprintId)),
    queueItem("no-estimate", "No Estimate", "Missing story points and estimate", missingEstimateIssues(issues)),
  ]
}

export function workspaceRecentItems(state: AppState): WorkspaceItem[] {
  const issues = allIssues(state)
    .filter((issue) => issue.key !== state.selectedIssueKey)
    .sort((left, right) => updatedScore(right) - updatedScore(left))
  const selected = allIssues(state).find((issue) => issue.key === state.selectedIssueKey)
  return [selected, ...issues].filter(Boolean).slice(0, 4).map((issue) => ({
    id: `recent:${issue!.key}`,
    section: "recent" as const,
    title: issue!.key,
    subtitle: `${issue!.title} · ${issue!.updatedAt ?? "not updated"}`,
    issueKey: issue!.key,
  }))
}

export function workspaceSelectedItem(state: AppState) {
  return workspaceItems(state)[state.workspaceSelectedIndex]
}

export function workspaceResultsForItem(state: AppState, item?: WorkspaceItem): WorkspaceResult[] {
  if (!item) return []
  if (item.section === "pending") {
    return stagedChanges(state).map((change) => ({
      id: change.id,
      kind: "change" as const,
      title: stagedResultTitle(change),
      subtitle: stagedResultSubtitle(state, change),
      issueKey: change.kind === "config" ? undefined : change.issueKey,
    }))
  }
  const issuesByKey = new Map(allIssues(state).map((issue) => [issue.key, issue]))
  const issueKeys = item.issueKey ? [item.issueKey] : (item.issueKeys ?? [])
  return issueKeys.flatMap((issueKey) => {
    const issue = issuesByKey.get(issueKey)
    if (!issue) return []
    return [{
      id: `issue:${issue.key}`,
      kind: "issue" as const,
      title: `${issue.key} ${issue.title}`,
      subtitle: issueResultSubtitle(state, item, issue),
      issueKey: issue.key,
    }]
  })
}

export function workspaceCurrentResults(state: AppState) {
  return workspaceResultsForItem(state, workspaceSelectedItem(state))
}

function queueItem(id: string, title: string, subtitle: string, issues: IssueSummary[]): WorkspaceItem {
  return {
    id: `queue:${id}`,
    section: "attention",
    title,
    subtitle,
    count: issues.length,
    issueKeys: issues.map((issue) => issue.key),
  }
}

function issueResultSubtitle(state: AppState, item: WorkspaceItem, issue: IssueSummary) {
  const reason = issueReason(state, item, issue)
  return `${reason} · ${issue.type} · ${issue.priority} · ${issue.assignee} · ${statusName(state, issue)}`
}

function issueReason(state: AppState, item: WorkspaceItem, issue: IssueSummary) {
  switch (item.id) {
    case "jump:my-work":
      return `assigned to ${state.currentUser}${issue.staleDays >= 7 ? ` · stale ${issue.staleDays}d` : ""}`
    case "queue:blocked":
      return `${issue.blocked ? "blocked flag" : "blocked status"}${issue.staleDays >= 7 ? ` · stale ${issue.staleDays}d` : ""}`
    case "queue:stale":
      return `stale ${issue.staleDays}d · updated ${issue.updatedAt ?? "unknown"}`
    case "queue:unassigned":
      return `no assignee · ${sprintLabel(state, issue)}`
    case "queue:no-sprint":
      return "not assigned to a sprint"
    case "queue:no-estimate":
      return "story points and estimate missing"
    default:
      return `updated ${issue.updatedAt ?? "unknown"}`
  }
}

function blockedIssues(issues: IssueSummary[]) {
  return issues.filter((issue) => issue.blocked || issue.statusId === "blocked")
}

function staleIssues(issues: IssueSummary[]) {
  return issues.filter((issue) => issue.staleDays >= 7)
}

function missingEstimateIssues(issues: IssueSummary[]) {
  return issues.filter((issue) => !issue.storyPoints && !issue.estimate)
}

function countLabel(count: number, label: string) {
  return `${count} ${label}${count === 1 ? "" : "s"}`
}

function stagedResultTitle(change: ReturnType<typeof stagedChanges>[number]) {
  if (change.kind === "config") return change.value
  if (change.kind === "create") return `${change.issueKey} create issue`
  if (change.kind === "delete") return `${change.issueKey} delete issue`
  return `${change.issueKey} ${change.label}`
}

function stagedResultSubtitle(state: AppState, change: ReturnType<typeof stagedChanges>[number]) {
  if (change.kind === "config") return "Local metadata overlay"
  if (change.kind === "create") return state.issues[change.issueKey]?.title ?? "New issue"
  if (change.kind === "delete") return state.issues[change.issueKey]?.title ?? "Unknown issue"
  if (change.kind === "rank") return `${change.position === "before" ? "Before" : "After"} ${change.targetIssueKey}`
  return change.value.replace(/\s+/g, " ").slice(0, 72)
}

function sprintLabel(state: AppState, issue: IssueSummary) {
  return state.sprints.find((sprint) => sprint.id === issue.sprintId)?.name ?? "Backlog"
}

function updatedScore(issue: IssueSummary) {
  if (issue.updatedAt === "now") return Number.MAX_SAFE_INTEGER
  return Date.parse(issue.updatedAt ?? "") || 0
}
