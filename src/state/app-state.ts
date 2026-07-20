import type { AppRoute } from "./routes"

export type ProjectSummary = {
  key: string
  name: string
}

export type BoardSummary = {
  id: string
  name: string
  type: "scrum" | "kanban"
}

export type SprintSummary = {
  id: string
  name: string
  goal: string
}

export type IssuePriority = "Low" | "Medium" | "High" | "Critical"

export type IssueType = "Bug" | "Story" | "Task" | "Epic"

export type IssueSummary = {
  key: string
  title: string
  type: IssueType
  priority: IssuePriority
  status: string
  assignee: string
  epic?: string
  blocked: boolean
  staleDays: number
}

export type StatusColumn = {
  id: string
  name: string
  issueKeys: string[]
}

export type WorkspaceStats = {
  todo: number
  inProgress: number
  done: number
  blocked: number
  stale: number
  unassigned: number
}

export type AppState = {
  demoMode: boolean
  route: AppRoute
  project: ProjectSummary
  board: BoardSummary
  sprint: SprintSummary
  columns: StatusColumn[]
  issues: Record<string, IssueSummary>
  selectedIssueKey: string
  stats: WorkspaceStats
}
