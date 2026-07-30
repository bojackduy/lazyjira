import type { AppRoute } from "./routes"
import type { RuntimeEnv } from "../runtime/env"

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
  startDate?: string
  endDate?: string
}

export type IssuePriority = "Low" | "Medium" | "High" | "Critical"

export type IssueType = string

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
  hierarchyLevel?: number
  subtask?: boolean
  iconUrl?: string
}

export type ParentIssueSummary = {
  key: string
  title?: string
  type?: IssueType
  typeName?: string
}

export type IssueComment = {
  id: string
  author: string
  body: string
  age: string
  writeBlockedReason?: string
}

export type IssueCommentDraft = {
  id: string
  issueKey: string
  body: string
}

export type IssueRankDraft = {
  issueKey: string
  targetIssueKey: string
  position: "before" | "after"
}

export type JiraUserOption = {
  accountId: string
  displayName: string
}

export type InspectorUserPicker = {
  fieldId: "assignee" | "reporter"
  issueKey: string
  query: string
  allOptions: JiraUserOption[]
  options: JiraUserOption[]
  selectedIndex: number
  loading: boolean
  error?: string
}

export type IssuePageState = {
  sourceId: string
  startAt: number
  cursor?: string
  maxResults: number
  total?: number
  isLast: boolean
  loading: boolean
  refreshing?: boolean
  error?: string
}

export type ProjectListSort = "rank" | "updated"

export type TimelineZoom = "day" | "week" | "month"

export type TimelineStartDateField =
  | { status: "available"; fieldId: string }
  | { status: "unavailable"; reason: "not-found" | "ambiguous"; candidateIds?: string[] }

export type BoardGroupBy = "none" | "assignee" | "epic" | "feature" | "space" | "issueType" | "priority"

export type BoardMode = "active-sprint" | "kanban"

export type BoardLocation = {
  groupIndex: number
  statusIndex: number
  itemIndex: number
}

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

export type ConfigSectionId = "columns" | "statuses" | "issue-types" | "priorities" | "fields" | "quick-filters"

export type ConfigFocusArea = "sections" | "rows"

export type ConfigEditAction = "add" | "rename" | "color"

export type ConfigEditing = {
  action: ConfigEditAction
  sectionId: ConfigSectionId
  targetId?: string
}

export type ConfigDraft = {
  id: string
  sectionId: Extract<ConfigSectionId, "columns" | "statuses" | "issue-types">
  action: ConfigEditAction | "remove"
  targetId?: string
  name?: string
  color?: string
  category?: StatusCategory
}

export type AuthOnboardingStep = "baseUrl" | "email" | "apiToken"

export type AuthOnboardingState = {
  open: boolean
  step: AuthOnboardingStep
  baseUrl: string
  email: string
  apiToken: string
  saving: boolean
  error?: string
}

export type ProjectOption = {
  id: string
  key: string
  name: string
}

export type BoardOption = {
  id: string
  name: string
  type: "scrum" | "kanban"
}

export type WorkspaceOption = {
  id: string
  projectKey: string
  projectName: string
  boardId: string
  boardName: string
  boardType: "scrum" | "kanban"
}

export type ProjectPickerState = {
  open: boolean
  mode: "local" | "remote-projects" | "remote-boards"
  searchOpen: boolean
  searchQuery: string
  loading: boolean
  saving: boolean
  error?: string
  selectedIndex: number
  remoteProjectCache?: ProjectOption[]
  remoteBoardsByProject: Record<string, BoardOption[]>
  selectedProject?: ProjectOption
}

export type FocusPane = "sidebar" | "main" | "inspector"

export type WorkspaceFocusArea = "cards" | "results"

export type SearchMode = "loaded" | "remote"

export type QuickFilterId = "mine" | "blocked" | "stale" | "unassigned"

export type QuickFilterDefinition = {
  id: QuickFilterId
  label: string
}

export type IssueSummary = {
  key: string
  title: string
  type: IssueType
  typeName?: string
  priority: IssuePriority
  statusId: string
  assignee: string
  assigneeAccountId?: string
  reporter: string
  epic?: string
  feature?: string
  space?: string
  sprintId?: string
  parentKey?: string
  parent?: ParentIssueSummary
  storyPoints?: number
  estimate?: number
  startDate?: string
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
  descriptionWriteBlockedReason?: string
  comments: IssueComment[]
  links: string[]
}

export type StatusColumn = {
  id: string
  name: string
  issueKeys: string[]
  statusIds?: string[]
  category?: StatusCategory
  color?: string
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
  runtimeEnv: RuntimeEnv
  route: AppRoute
  previousRoute?: AppRoute
  focusedPane: FocusPane
  jiraAuthReady: boolean
  jiraProjectReady: boolean
  workspaceLoading: boolean
  workspaceLoadError?: string
  workspaceRequestId: number
  workspaceNotice?: string
  authOnboarding: AuthOnboardingState
  projectPicker: ProjectPickerState
  recentWorkspaces: WorkspaceOption[]
  sidebarSelectedIndex: number
  workspaceSelectedIndex: number
  workspaceFocusedArea: WorkspaceFocusArea
  workspaceResultSelectedIndex: number
  commandPaletteOpen: boolean
  commandPaletteQuery: string
  commandPaletteSelectedIndex: number
  helpOpen: boolean
  searchOpen: boolean
  searchMode: SearchMode
  searchQuery: string
  searchDraft: string
  remoteSearchQuery: string
  remoteSearchIssueKeys: string[]
  remoteSearchPageState: IssuePageState
  remoteSearchRequestId: number
  configSelectedSectionIndex: number
  configSelectedRowIndex: number
  configFocusedArea: ConfigFocusArea
  configEditing?: ConfigEditing
  configEditValue: string
  configDraftCounter: number
  configDrafts: ConfigDraft[]
  project: ProjectSummary
  board: BoardSummary
  currentUser: string
  currentUserAccountId?: string
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
  selectedBacklogGroupId: string
  collapsedBacklogGroupIds: string[]
  activeSprintStatusOffset: number
  kanbanStatusOffset: number
  selectedIssueKey: string
  selectedBoardLocations: Partial<Record<BoardMode, BoardLocation>>
  inspectorSelectedFieldIndex: number
  inspectorEditingFieldId?: IssueEditableField
  inspectorEditValue: string
  inspectorUserPicker?: InspectorUserPicker
  userDraftAccountIds: Record<string, Partial<Record<"assignee" | "reporter", string>>>
  issueDrafts: Record<string, IssueDraft>
  commentDrafts: IssueCommentDraft[]
  commentDraftCounter: number
  commentEditing: boolean
  commentEditValue: string
  rankDrafts: Record<string, IssueRankDraft>
  issueDeletes: string[]
  issueDetailLoadingByKey: Record<string, boolean>
  issueDetailErrorByKey: Record<string, string | undefined>
  issueDetailLoadedAtByKey: Record<string, string>
  issueDetailRequestId: number
  issuePageStateBySource: Record<string, IssuePageState>
  issueKeysBySource: Record<string, string[]>
  issuePageRequestIdBySource: Record<string, number>
  projectListSelectedIssueKey?: string
  projectListHorizontalOffset: number
  projectListSort: ProjectListSort
  timelineStartDateField: TimelineStartDateField
  timelineParentHydrationError?: string
  timelineSelectedIssueKey?: string
  timelineWindowStart: string
  timelineZoom: TimelineZoom
  collapsedTimelineParentKeys: string[]
  pendingDeleteIssueKey?: string
  remoteApplyOpen: boolean
  remoteApplyApplying: boolean
  remoteDeleteConfirmationArmed: boolean
  stagedDiscardOpen: boolean
  stagedDiscardSelectedIndex: number
  stagedDiscardSelections: string[]
  detailBodyEditing: boolean
  detailBodyEditValue: string
  draftIssueCounter: number
  stats: WorkspaceStats
}
