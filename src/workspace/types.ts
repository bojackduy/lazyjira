import type { RuntimeEnv } from "../runtime/env"
import type { AppState, BoardSummary, IssueSummary, IssueTypeDefinition, ProjectSummary, QuickFilterDefinition, SprintSummary, StatusColumn, StatusDefinition, WorkspaceStats } from "../state/app-state"

export type WorkspaceSelection = {
  project: ProjectSummary
  board: BoardSummary
}

export type LoadedWorkspace = WorkspaceSelection & Pick<AppState, "currentUser" | "quickFilters" | "activeSprintId" | "sprints" | "statuses" | "issueTypes" | "columns" | "stats" | "selectedIssueKey"> & {
  issues: Record<string, IssueSummary>
  notice?: string
}

export type WorkspaceSource = {
  env: RuntimeEnv
  fetchProjects: () => Promise<Array<ProjectSummary & { id: string }>>
  fetchBoards: (projectKeyOrId: string) => Promise<BoardSummary[]>
  loadWorkspace: (selection: WorkspaceSelection) => Promise<LoadedWorkspace>
}

export type WorkspaceFixtureInput = WorkspaceSelection & {
  currentUser?: string
  activeSprintId?: string
  sprints: SprintSummary[]
  statuses: StatusDefinition[]
  columns?: StatusColumn[]
  issueTypes: IssueTypeDefinition[]
  issues: IssueSummary[]
  quickFilters?: QuickFilterDefinition[]
  selectedIssueKey?: string
  notice?: string
}

export function createLoadedWorkspace(input: WorkspaceFixtureInput): LoadedWorkspace {
  const activeSprintId = input.activeSprintId ?? input.sprints.find((sprint) => sprint.state === "active")?.id ?? input.sprints[0]?.id ?? ""
  const enrichedIssues = input.issues.map((issue, index) => enrichIssue(input.statuses, issue, index))
  const issues = Object.fromEntries(enrichedIssues.map((issue) => [issue.key, issue]))
  const selectedIssueKey = input.selectedIssueKey && issues[input.selectedIssueKey] ? input.selectedIssueKey : (enrichedIssues[0]?.key ?? "")
  return {
    project: input.project,
    board: input.board,
    currentUser: input.currentUser ?? "Duy",
    quickFilters: input.quickFilters ?? defaultQuickFilters(),
    activeSprintId,
    sprints: input.sprints,
    statuses: input.statuses,
    issueTypes: input.issueTypes,
    columns: input.columns ?? input.statuses.map((status) => ({
      id: status.id,
      name: status.name,
      issueKeys: enrichedIssues.filter((issue) => issue.sprintId === activeSprintId && issue.statusId === status.id).map((issue) => issue.key),
    })),
    issues,
    stats: workspaceStats(input.statuses, enrichedIssues),
    selectedIssueKey,
    notice: input.notice,
  }
}

export function defaultQuickFilters(): QuickFilterDefinition[] {
  return [
    { id: "mine", label: "Only My Issues" },
    { id: "blocked", label: "Blocked" },
    { id: "stale", label: "Stale" },
    { id: "unassigned", label: "Unassigned" },
  ]
}

function enrichIssue(statuses: StatusDefinition[], issue: IssueSummary, index: number): IssueSummary {
  const dueDay = String(8 + (index % 18)).padStart(2, "0")
  return {
    ...issue,
    estimate: issue.estimate ?? (issue.storyPoints ? issue.storyPoints * 2 : undefined),
    dueDate: issue.dueDate ?? `2026-08-${dueDay}`,
    createdAt: issue.createdAt ?? `2026-07-${String(1 + (index % 12)).padStart(2, "0")}`,
    updatedAt: issue.updatedAt ?? `2026-07-${String(12 + (index % 10)).padStart(2, "0")}`,
    resolution: issue.resolution ?? (statuses.find((status) => status.id === issue.statusId)?.category === "done" ? "Done" : undefined),
    fixVersions: issue.fixVersions ?? (index % 3 === 0 ? ["2026.08"] : []),
    affectsVersions: issue.affectsVersions ?? (issue.type === "Bug" ? ["2026.07"] : []),
    rank: issue.rank ?? `R-${String(index + 1).padStart(3, "0")}`,
  }
}

function workspaceStats(statuses: StatusDefinition[], issues: IssueSummary[]): WorkspaceStats {
  return {
    todo: issues.filter((issue) => statuses.find((status) => status.id === issue.statusId)?.category === "todo").length,
    inProgress: issues.filter((issue) => ["in-progress", "review", "blocked"].includes(statuses.find((status) => status.id === issue.statusId)?.category ?? "")).length,
    done: issues.filter((issue) => statuses.find((status) => status.id === issue.statusId)?.category === "done").length,
    blocked: issues.filter((issue) => issue.blocked || issue.statusId === "blocked").length,
    stale: issues.filter((issue) => issue.staleDays >= 7).length,
    unassigned: issues.filter((issue) => issue.assignee === "Unassigned").length,
  }
}
