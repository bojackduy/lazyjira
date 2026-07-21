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
  state: "active" | "future" | "closed"
}

export type IssuePriority = "Low" | "Medium" | "High" | "Critical"

export type IssueType = "Bug" | "Story" | "Task" | "Subtask" | "Feature" | "Epic"

export type StatusCategory = "todo" | "in-progress" | "review" | "blocked" | "done"

export type StatusDefinition = {
  id: string
  name: string
  category: StatusCategory
  color: string
}

export type IssueTypeDefinition = {
  id: IssueType
  name: string
  color: string
}

export type IssueComment = {
  id: string
  author: string
  body: string
  age: string
}

export type BoardGroupBy = "none" | "assignee" | "epic" | "feature" | "space" | "issueType" | "priority"

export type BoardMode = "active-sprint" | "kanban"

export type BacklogGroupBy = "sprint" | Exclude<BoardGroupBy, "none">

export type IssueEditableField =
  | "title"
  | "type"
  | "statusId"
  | "priority"
  | "assignee"
  | "reporter"
  | "sprintId"
  | "parentKey"
  | "storyPoints"
  | "estimate"
  | "dueDate"
  | "epic"
  | "feature"
  | "space"
  | "labels"
  | "components"
  | "fixVersions"
  | "affectsVersions"
  | "links"
  | "blocked"
  | "description"

export type IssueDraft = Partial<Record<IssueEditableField, string>>

export type FocusPane = "sidebar" | "main" | "inspector"

export type QuickFilterId = "mine" | "blocked" | "stale" | "unassigned"

export type QuickFilterDefinition = {
  id: QuickFilterId
  label: string
}

export type IssueSummary = {
  key: string
  title: string
  type: IssueType
  priority: IssuePriority
  statusId: string
  assignee: string
  reporter: string
  epic?: string
  feature?: string
  space?: string
  sprintId?: string
  parentKey?: string
  storyPoints?: number
  estimate?: number
  dueDate?: string
  createdAt?: string
  updatedAt?: string
  resolution?: string
  fixVersions?: string[]
  affectsVersions?: string[]
  rank?: string
  isDraft?: boolean
  labels: string[]
  components: string[]
  blocked: boolean
  staleDays: number
  description: string
  comments: IssueComment[]
  links: string[]
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
  focusedPane: FocusPane
  sidebarSelectedIndex: number
  project: ProjectSummary
  board: BoardSummary
  currentUser: string
  quickFilters: QuickFilterDefinition[]
  activeQuickFilters: QuickFilterId[]
  activeSprintId: string
  sprints: SprintSummary[]
  statuses: StatusDefinition[]
  issueTypes: IssueTypeDefinition[]
  columns: StatusColumn[]
  issues: Record<string, IssueSummary>
  activeSprintGroupBy: BoardGroupBy
  kanbanGroupBy: BoardGroupBy
  backlogGroupBy: BacklogGroupBy
  activeSprintStatusOffset: number
  kanbanStatusOffset: number
  selectedIssueKey: string
  inspectorSelectedFieldIndex: number
  inspectorEditingFieldId?: IssueEditableField
  inspectorEditValue: string
  issueDrafts: Record<string, IssueDraft>
  draftIssueCounter: number
  stats: WorkspaceStats
}
