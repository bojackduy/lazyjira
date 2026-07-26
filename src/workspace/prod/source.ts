import { loadJiraAuthConfig, type JiraAuthConfig } from "../../auth/config"
import { fetchAccessibleProjects, fetchBoardBacklogIssuePage, fetchBoardConfiguration, fetchBoardIssuePage, fetchBoardSprints, fetchIssueComments, fetchIssueDetail, fetchJiraFields, fetchJiraSearchIssuePage, fetchProjectBoards, fetchProjectStatuses, fetchSprintIssuePage, fetchSprintIssues, fetchStatusesByIds, postJiraIssueComment, type FetchLike, type JiraBoardConfiguration, type JiraIssue, type JiraPage } from "../../jira/client"
import { discoverJiraIssueFieldIds, issueCustomFieldIds, mergeIssueDetail, normalizeBoardConfiguration, normalizeBoardSprints, normalizeJiraComments, normalizeJiraIssues, normalizeProjectStatuses, normalizeSprintIssues, type JiraIssueFieldIds } from "../../jira/normalize"
import type { IssuePageState, SprintSummary } from "../../state/app-state"
import { backlogIssuePageSourceId, boardIssuePageSourceId, defaultIssuePageState, remoteSearchIssuePageSourceId, sprintIssuePageSourceId } from "../../state/issue-pages"
import { issueTypeColors, statusColorForCategory } from "../../state/metadata-colors"
import { createLoadedWorkspace, type WorkspaceSelection, type WorkspaceSource } from "../types"

const prodPlaceholderStatuses = [
  { id: "todo", name: "To Do", category: "todo" as const, color: statusColorForCategory("todo") },
  { id: "in-progress", name: "In Progress", category: "in-progress" as const, color: statusColorForCategory("in-progress") },
  { id: "done", name: "Done", category: "done" as const, color: statusColorForCategory("done") },
]

const prodPlaceholderIssueTypes = [
  { id: "Task", name: "Task", color: issueTypeColors.task },
  { id: "Bug", name: "Bug", color: issueTypeColors.bug },
]

export function createProdWorkspaceSource(authLoader: () => Promise<JiraAuthConfig | undefined> = loadJiraAuthConfig, fetchImpl: FetchLike = fetch): WorkspaceSource {
  let cachedFieldIds: JiraIssueFieldIds | undefined

  async function issueFieldIds(auth: JiraAuthConfig) {
    cachedFieldIds ??= discoverJiraIssueFieldIds(await fetchJiraFields(auth, fetchImpl))
    return cachedFieldIds
  }

  return {
    env: "prod",
    async fetchProjects() {
      return fetchAccessibleProjects(await requireJiraAuth(authLoader), fetchImpl)
    },
    async fetchBoards(projectKeyOrId) {
      return fetchProjectBoards(await requireJiraAuth(authLoader), projectKeyOrId, fetchImpl)
    },
    async loadWorkspace(selection) {
      if (!selection.board.id) return createProdWorkspace(selection)
      const auth = await requireJiraAuth(authLoader)
      const [boardConfig, statusIssueTypes, sprints, jiraFields] = await Promise.all([
        fetchBoardConfiguration(auth, selection.board.id, fetchImpl),
        fetchProjectStatuses(auth, selection.project.key, fetchImpl),
        selection.board.type === "scrum" ? fetchBoardSprints(auth, selection.board.id, fetchImpl) : Promise.resolve([]),
        issueFieldIds(auth),
      ])
      const statusLookup = normalizeProjectStatuses(statusIssueTypes)
      const missingStatusIds = boardStatusIds(boardConfig).filter((statusId) => !statusLookup.has(statusId))
      if (missingStatusIds.length) {
        const missingStatuses = normalizeProjectStatuses([{ statuses: await fetchStatusesByIds(auth, missingStatusIds, fetchImpl) }])
        for (const [statusId, status] of missingStatuses) statusLookup.set(statusId, status)
      }
      const metadata = normalizeBoardConfiguration(boardConfig, statusLookup)
      const normalizedSprints = normalizeBoardSprints(sprints)
      const fieldIds = jiraFields
      const customFields = issueCustomFieldIds(fieldIds)
      const activeSprints = normalizedSprints.filter((sprint) => sprint.state === "active")
      const [activeSprintIssuePages, backlogPage] = await Promise.all([
        Promise.all(activeSprints.map(async (sprint) => normalizeSprintIssues(await fetchSprintIssues(auth, sprint.id, fetchImpl, customFields), sprint.id, metadata.statuses, fieldIds))),
        selection.board.type === "scrum" ? fetchBoardBacklogIssuePage(auth, selection.board.id, fetchImpl, customFields) : Promise.resolve(emptyJiraPage<JiraIssue>(0, 100)),
      ])
      const issues = uniqueIssues([
        ...activeSprintIssuePages.flat(),
        ...normalizeJiraIssues(backlogPage.items, metadata.statuses, { fieldIds }),
      ])
      return createProdWorkspace(selection, metadata, normalizedSprints, issues, initialIssuePageStates(selection.board.type, normalizedSprints, activeSprintIssuePages, backlogPage))
    },
    async loadIssueDetail(issueKey, context) {
      const auth = await requireJiraAuth(authLoader)
      const fieldIds = await issueFieldIds(auth)
      const [issue, comments] = await Promise.all([
        fetchIssueDetail(auth, issueKey, fetchImpl, issueCustomFieldIds(fieldIds)),
        fetchIssueComments(auth, issueKey, fetchImpl),
      ])
      const detail = normalizeJiraIssues([issue], context.statuses, { fallbackSprintId: context.existingIssue?.sprintId, fieldIds })[0]
      if (!detail) throw new Error(`Jira issue ${issueKey} did not include readable issue fields`)
      return { issue: mergeIssueDetail(context.existingIssue, detail, normalizeJiraComments(comments)) }
    },
    async loadIssuePage(sourceId, context) {
      const auth = await requireJiraAuth(authLoader)
      const fieldIds = await issueFieldIds(auth)
      const page = await fetchIssuePage(auth, sourceId, context.board.id, context.pageState.startAt, context.pageState.maxResults, issueCustomFieldIds(fieldIds), fetchImpl)
      return {
        sourceId,
        issues: normalizeJiraIssues(page.items, context.statuses, { fieldIds }),
        pageState: pageStateFromJiraPage(sourceId, page),
      }
    },
    async searchIssues(query, context) {
      const auth = await requireJiraAuth(authLoader)
      const fieldIds = await issueFieldIds(auth)
      const page = await fetchJiraSearchIssuePage(auth, searchJql(context.project.key, query), fetchImpl, issueCustomFieldIds(fieldIds), context.pageState.startAt, context.pageState.maxResults, context.pageState.cursor)
      return {
        query,
        issues: normalizeJiraIssues(page.items, context.statuses, { fieldIds }),
        pageState: pageStateFromJiraPage(remoteSearchIssuePageSourceId, page),
      }
    },
    async postIssueComment(issueKey, body) {
      await postJiraIssueComment(await requireJiraAuth(authLoader), issueKey, body, fetchImpl)
    },
  }
}

export function createProdWorkspacePlaceholder(selection: WorkspaceSelection) {
  return createProdWorkspace(selection)
}

function createProdWorkspace(selection: WorkspaceSelection, metadata?: ReturnType<typeof normalizeBoardConfiguration>, sprints: ReturnType<typeof normalizeBoardSprints> = [], issues: ReturnType<typeof normalizeSprintIssues> = [], issuePageStateBySource: Record<string, IssuePageState> = {}) {
  const notice = selection.project.key === "JIRA"
    ? "Prod runtime is waiting for a Jira project selection. Tickets stay empty until a project is selected."
    : issues.length
      ? "Prod active sprint and bounded backlog issues are loaded from Jira. Issue detail and comments load on open."
      : metadata?.statuses.length
        ? "Prod board metadata and sprints are loaded from Jira. Active sprint has no loaded issues yet."
      : "Prod project and board selection are real. No Jira issues were loaded for this workspace yet."
  return createLoadedWorkspace({
    ...selection,
    activeSprintId: sprints.find((sprint) => sprint.state === "active")?.id ?? sprints[0]?.id ?? "",
    sprints,
    statuses: metadata?.statuses.length ? metadata.statuses : prodPlaceholderStatuses,
    columns: metadata?.columns.length ? metadata.columns : undefined,
    issueTypes: prodPlaceholderIssueTypes,
    issues,
    issuePageStateBySource,
    selectedIssueKey: "",
    notice,
  })
}

function initialIssuePageStates(boardType: WorkspaceSelection["board"]["type"], sprints: SprintSummary[], activeSprintIssuePages: JiraIssue[][], backlogPage: JiraPage<JiraIssue>): Record<string, IssuePageState> {
  const states: Record<string, IssuePageState> = {}
  const activeSprints = sprints.filter((sprint) => sprint.state === "active")
  activeSprints.forEach((sprint, index) => {
    const loaded = activeSprintIssuePages[index]?.length ?? 0
    states[sprintIssuePageSourceId(sprint.id)] = { sourceId: sprintIssuePageSourceId(sprint.id), startAt: loaded, maxResults: 50, total: loaded, isLast: true, loading: false }
  })
  for (const sprint of sprints.filter((sprint) => sprint.state === "future")) states[sprintIssuePageSourceId(sprint.id)] = defaultIssuePageState(sprintIssuePageSourceId(sprint.id))
  if (boardType === "scrum") states[backlogIssuePageSourceId] = pageStateFromJiraPage(backlogIssuePageSourceId, backlogPage)
  else states[boardIssuePageSourceId] = defaultIssuePageState(boardIssuePageSourceId)
  return states
}

function pageStateFromJiraPage<T>(sourceId: string, page: JiraPage<T>): IssuePageState {
  return { sourceId, startAt: page.nextStartAt, cursor: page.cursor, maxResults: page.maxResults, total: page.total, isLast: page.isLast, loading: false }
}

function emptyJiraPage<T>(startAt: number, maxResults: number): JiraPage<T> {
  return { items: [], startAt, maxResults, isLast: true, nextStartAt: startAt }
}

function fetchIssuePage(auth: JiraAuthConfig, sourceId: string, boardId: string, startAt: number, maxResults: number, customFields: string[], fetchImpl: FetchLike) {
  if (sourceId === backlogIssuePageSourceId) return fetchBoardBacklogIssuePage(auth, boardId, fetchImpl, customFields, startAt, maxResults)
  if (sourceId === boardIssuePageSourceId) return fetchBoardIssuePage(auth, boardId, fetchImpl, customFields, startAt, maxResults)
  if (sourceId.startsWith("sprint:")) return fetchSprintIssuePage(auth, sourceId.slice("sprint:".length), fetchImpl, customFields, startAt, maxResults)
  throw new Error(`Unknown Jira issue page source ${sourceId}`)
}

function searchJql(projectKey: string, query: string) {
  return `project = ${jqlString(projectKey)} AND text ~ ${jqlString(query)} ORDER BY updated DESC`
}

function jqlString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

async function requireJiraAuth(authLoader: () => Promise<JiraAuthConfig | undefined>) {
  const auth = await authLoader()
  if (!auth) throw new Error("Jira credentials are required. Run `lazyjira auth login` or complete onboarding.")
  return auth
}

function boardStatusIds(config: JiraBoardConfiguration) {
  const ids: string[] = []
  for (const column of config.columnConfig?.columns ?? []) {
    for (const status of column.statuses ?? []) {
      if (status.id && !ids.includes(status.id)) ids.push(status.id)
    }
  }
  return ids
}

function uniqueIssues<T extends { key: string }>(issues: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const issue of issues) {
    if (!byKey.has(issue.key)) byKey.set(issue.key, issue)
  }
  return [...byKey.values()]
}
