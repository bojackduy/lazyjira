import { loadJiraAuthConfig, type JiraAuthConfig } from "../../auth/config"
import { createJiraIssue, createJiraIssueLink, deleteJiraIssue, fetchAccessibleProjects, fetchAssignableUsers, fetchBoardBacklogIssuePage, fetchBoardConfiguration, fetchBoardIssuePage, fetchBoardSprints, fetchCurrentJiraUser, fetchIssueComments, fetchIssueDetail, fetchJiraCreateIssueTypes, fetchJiraFields, fetchJiraIssueEditMetadata, fetchJiraIssueLinkTypes, fetchJiraIssueTransitions, fetchJiraSearchIssuePage, fetchProjectBoards, fetchProjectStatuses, fetchSprintIssuePage, fetchSprintIssues, fetchStatusesByIds, JiraApiError, moveJiraIssueToSprint, postJiraIssueComment, rankJiraIssue, transitionJiraIssue, updateJiraIssue, type FetchLike, type JiraBoardConfiguration, type JiraIssue, type JiraPage, type JiraUser } from "../../jira/client"
import { discoverJiraIssueFieldIds, discoverJiraStartDateField, issueCustomFieldIds, mergeIssueDetail, normalizeBoardConfiguration, normalizeBoardSprints, normalizeJiraComments, normalizeJiraIssues, normalizeProjectStatuses, normalizeSprintIssues, type JiraIssueFieldIds } from "../../jira/normalize"
import { markdownToAdf } from "../../jira/adf"
import type { IssuePageState, IssueSummary, SprintSummary, TimelineStartDateField } from "../../state/app-state"
import { backlogIssuePageSourceId, boardIssuePageSourceId, defaultIssuePageState, projectListIssuePageSourceId, remoteSearchIssuePageSourceId, sprintIssuePageSourceId } from "../../state/issue-pages"
import { issueTypeColorForName, issueTypeColors, statusColorForCategory } from "../../state/metadata-colors"
import type { IssueTypeDefinition } from "../../state/app-state"
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

const parentHydrationChunkSize = 25
const maxHydratedParents = 200

export function createProdWorkspaceSource(authLoader: () => Promise<JiraAuthConfig | undefined> = loadJiraAuthConfig, fetchImpl: FetchLike = fetch): WorkspaceSource {
  let cachedFields: { ids: JiraIssueFieldIds; startDate: TimelineStartDateField } | undefined

  async function issueFields(auth: JiraAuthConfig) {
    if (!cachedFields) {
      const fields = await fetchJiraFields(auth, fetchImpl)
      cachedFields = { ids: discoverJiraIssueFieldIds(fields), startDate: discoverJiraStartDateField(fields) }
    }
    return cachedFields
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
      const [boardConfig, statusIssueTypes, createIssueTypes, sprints, jiraFields, currentUser] = await Promise.all([
        fetchBoardConfiguration(auth, selection.board.id, fetchImpl),
        fetchProjectStatuses(auth, selection.project.key, fetchImpl),
        fetchJiraCreateIssueTypes(auth, selection.project.key, fetchImpl),
        selection.board.type === "scrum" ? fetchBoardSprints(auth, selection.board.id, fetchImpl) : Promise.resolve([]),
        issueFields(auth),
        fetchCurrentJiraUser(auth, fetchImpl),
      ])
      const statusLookup = normalizeProjectStatuses(statusIssueTypes)
      const missingStatusIds = boardStatusIds(boardConfig).filter((statusId) => !statusLookup.has(statusId))
      if (missingStatusIds.length) {
        const missingStatuses = normalizeProjectStatuses([{ statuses: await fetchStatusesByIds(auth, missingStatusIds, fetchImpl) }])
        for (const [statusId, status] of missingStatuses) statusLookup.set(statusId, status)
      }
      const metadata = normalizeBoardConfiguration(boardConfig, statusLookup)
      const normalizedSprints = normalizeBoardSprints(sprints)
      const fieldIds = jiraFields.ids
      const customFields = issueCustomFieldIds(fieldIds)
      const activeSprints = normalizedSprints.filter((sprint) => sprint.state === "active")
      const [activeSprintIssuePages, boardPage, backlogLoad] = await Promise.all([
        Promise.all(activeSprints.map(async (sprint) => normalizeSprintIssues(await fetchSprintIssues(auth, sprint.id, fetchImpl, customFields), sprint.id, metadata.statuses, fieldIds))),
        selection.board.type === "kanban" ? fetchBoardIssuePage(auth, selection.board.id, fetchImpl, customFields) : Promise.resolve(undefined),
        selection.board.type === "scrum"
          ? fetchBoardBacklogIssuePage(auth, selection.board.id, fetchImpl, customFields).then((page) => ({ page }))
          : loadOptionalKanbanBacklog(auth, selection.board.id, customFields, fetchImpl),
      ])
      const boardIssues = normalizeJiraIssues(boardPage?.items ?? [], metadata.statuses, { fieldIds })
      const backlogIssues = normalizeJiraIssues(backlogLoad.page?.items ?? [], metadata.statuses, { fieldIds })
      const issues = uniqueIssues([
        ...activeSprintIssuePages.flat(),
        ...boardIssues,
        ...backlogIssues,
      ])
      const issueKeysBySource = initialIssueKeysBySource(normalizedSprints, activeSprintIssuePages, boardIssues, backlogIssues)
      return createProdWorkspace(selection, metadata, normalizedSprints, issues, initialIssuePageStates(selection.board.type, normalizedSprints, activeSprintIssuePages, boardPage, backlogLoad), issueKeysBySource, normalizeCreateIssueTypes(createIssueTypes), jiraFields.startDate, currentUser)
    },
    async loadIssueDetail(issueKey, context) {
      const auth = await requireJiraAuth(authLoader)
      const fieldIds = (await issueFields(auth)).ids
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
      const fields = await issueFields(auth)
      const fieldIds = fields.ids
      const page = sourceId === projectListIssuePageSourceId
        ? await fetchJiraSearchIssuePage(auth, projectListJql(context.project.key, !!fieldIds.rank), fetchImpl, issueCustomFieldIds(fieldIds), context.pageState.startAt, context.pageState.maxResults, context.pageState.cursor)
        : await fetchIssuePage(auth, sourceId, context.board.id, context.pageState.startAt, context.pageState.maxResults, issueCustomFieldIds(fieldIds), fetchImpl)
      const issues = normalizeJiraIssues(page.items, context.statuses, { fieldIds })
      let relatedIssues: IssueSummary[] | undefined
      let parentHydrationError: string | undefined
      if (sourceId === projectListIssuePageSourceId) {
        try {
          relatedIssues = await hydrateMissingParents(auth, issues, context.knownIssueKeys ?? [], context.missingParentKeys ?? [], context.statuses, fieldIds, fetchImpl)
        } catch (error) {
          parentHydrationError = `Parent hydration failed: ${error instanceof Error ? error.message : String(error)}`
        }
      }
      return {
        sourceId,
        issues,
        relatedIssues,
        pageState: pageStateFromJiraPage(sourceId, page),
        sort: sourceId === projectListIssuePageSourceId ? (fieldIds.rank ? "rank" : "updated") : undefined,
        timelineStartDateField: sourceId === projectListIssuePageSourceId ? fields.startDate : undefined,
        parentHydrationError,
      }
    },
    async searchIssues(query, context) {
      const auth = await requireJiraAuth(authLoader)
      const fieldIds = (await issueFields(auth)).ids
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
    async updateIssue(issueKey, fields) {
      await updateJiraIssue(await requireJiraAuth(authLoader), issueKey, fields, fetchImpl)
    },
    async transitionIssue(issueKey, targetStatusId) {
      const auth = await requireJiraAuth(authLoader)
      const transition = (await fetchJiraIssueTransitions(auth, issueKey, fetchImpl)).find((candidate) => candidate.id && candidate.to?.id === targetStatusId)
      if (!transition?.id) throw new Error(`Jira does not offer a transition from ${issueKey} to the selected status.`)
      await transitionJiraIssue(auth, issueKey, transition.id, fetchImpl)
    },
    async moveIssueToSprint(issueKey, sprintId) {
      await moveJiraIssueToSprint(await requireJiraAuth(authLoader), issueKey, sprintId, fetchImpl)
    },
    async updateDiscoveredField(issueKey, field, value) {
      const auth = await requireJiraAuth(authLoader)
      const fieldIds = (await issueFields(auth)).ids
      const fieldId = field === "storyPoints" ? fieldIds.storyPoints : fieldIds.storyPointEstimate
      if (!fieldId) throw new Error(`Jira does not expose a ${field === "storyPoints" ? "story points" : "estimate"} field for this project.`)
      const number = value.trim() ? Number(value) : null
      if (number !== null && !Number.isFinite(number)) throw new Error(`${field === "storyPoints" ? "Story points" : "Estimate"} must be a number.`)
      await updateJiraIssue(auth, issueKey, { [fieldId]: number }, fetchImpl)
    },
    async updateIssueType(issueKey, type) {
      const auth = await requireJiraAuth(authLoader)
      const types = (await fetchJiraIssueEditMetadata(auth, issueKey, fetchImpl)).fields?.issuetype?.allowedValues ?? []
      const match = types.find((candidate) => candidate.id === type || candidate.name === type)
      if (!match?.id) throw new Error(`Jira does not allow changing ${issueKey} to issue type ${type}.`)
      await updateJiraIssue(auth, issueKey, { issuetype: { id: match.id } }, fetchImpl)
    },
    async deleteIssue(issueKey) {
      await deleteJiraIssue(await requireJiraAuth(authLoader), issueKey, fetchImpl)
    },
    async createIssue(issue, projectKey) {
      const auth = await requireJiraAuth(authLoader)
      const issueType = (await fetchJiraCreateIssueTypes(auth, projectKey, fetchImpl)).find((candidate) => candidate.id === issue.type || candidate.name === issue.type)
      if (!issueType?.id) throw new Error(`Jira does not allow creating issue type ${issue.type} in project ${projectKey}.`)
      const description = markdownToAdf(issue.description)
      if (!description.document) throw new Error(description.writeBlockedReason ?? "This Jira text cannot be converted safely.")
      const created = await createJiraIssue(auth, {
        project: { key: projectKey },
        summary: issue.title,
        issuetype: { id: issueType.id },
        priority: { name: issue.priority },
        labels: issue.labels,
        components: issue.components.map((name) => ({ name })),
        description: issue.description ? description.document : undefined,
        parent: issue.parentKey ? { key: issue.parentKey } : undefined,
      }, fetchImpl)
      if (!created.key) throw new Error("Jira created an issue without returning its key.")
      return created.key
    },
    async createIssueLinks(issueKey, targetIssueKeys) {
      const auth = await requireJiraAuth(authLoader)
      const types = await fetchJiraIssueLinkTypes(auth, fetchImpl)
      const linkType = types.find((type) => type.name === "Relates")?.name ?? types[0]?.name
      if (!linkType) throw new Error("Jira does not expose an issue link type.")
      for (const targetIssueKey of targetIssueKeys) await createJiraIssueLink(auth, issueKey, targetIssueKey, linkType, fetchImpl)
    },
    async rankIssue(issueKey, targetIssueKey, position) {
      await rankJiraIssue(await requireJiraAuth(authLoader), issueKey, targetIssueKey, position, fetchImpl)
    },
    async loadUserPicker(fieldId, issueKey, projectKey, query) {
      const auth = await requireJiraAuth(authLoader)
      const users = await fetchAssignableUsers(auth, projectKey, issueKey, query, fetchImpl)
      const normalizedQuery = query.trim().toLowerCase()
      return users
        .filter((user) => user.accountId && user.displayName && (!normalizedQuery || user.displayName.toLowerCase().includes(normalizedQuery)))
        .map((user) => ({ accountId: user.accountId!, displayName: user.displayName! }))
        .slice(0, 50)
    },
  }
}

export function createProdWorkspacePlaceholder(selection: WorkspaceSelection) {
  return createProdWorkspace(selection)
}

function normalizeCreateIssueTypes(types: Awaited<ReturnType<typeof fetchJiraCreateIssueTypes>>): IssueTypeDefinition[] {
  const normalized = types.flatMap((type) => {
    if (!type.id || !type.name) return []
    return [{
      id: type.id,
      name: type.name,
      color: issueTypeColorForName(type.name),
      hierarchyLevel: type.hierarchyLevel,
      subtask: type.subtask,
      iconUrl: type.iconUrl,
    }]
  })
  return normalized.length ? normalized : prodPlaceholderIssueTypes
}

function createProdWorkspace(selection: WorkspaceSelection, metadata?: ReturnType<typeof normalizeBoardConfiguration>, sprints: ReturnType<typeof normalizeBoardSprints> = [], issues: ReturnType<typeof normalizeSprintIssues> = [], issuePageStateBySource: Record<string, IssuePageState> = {}, issueKeysBySource: Record<string, string[]> = {}, issueTypes: IssueTypeDefinition[] = prodPlaceholderIssueTypes, timelineStartDateField: TimelineStartDateField = { status: "unavailable", reason: "not-found" }, currentUser?: JiraUser) {
  const notice = selection.project.key === "JIRA"
    ? "Prod runtime is waiting for a Jira project selection. Tickets stay empty until a project is selected."
    : issues.length
      ? selection.board.type === "scrum"
        ? "Prod active sprint and bounded backlog issues are loaded from Jira. Issue detail and comments load on open."
        : "Prod bounded Kanban board issues are loaded from Jira. Issue detail and comments load on open."
      : metadata?.statuses.length
        ? selection.board.type === "scrum"
          ? "Prod board metadata and sprints are loaded from Jira. Active sprint has no loaded issues yet."
          : "Prod board metadata is loaded from Jira. The bounded Kanban board page returned no issues."
      : "Prod project and board selection are real. No Jira issues were loaded for this workspace yet."
  return createLoadedWorkspace({
    ...selection,
    currentUser: currentUser?.displayName ?? "Current Jira user",
    currentUserAccountId: currentUser?.accountId,
    activeSprintId: sprints.find((sprint) => sprint.state === "active")?.id ?? "",
    sprints,
    statuses: metadata?.statuses.length ? metadata.statuses : prodPlaceholderStatuses,
    columns: metadata?.columns.length ? metadata.columns : undefined,
    issueTypes,
    issues,
    issuePageStateBySource,
    issueKeysBySource,
    selectedIssueKey: "",
    timelineStartDateField,
    notice,
  })
}

function initialIssuePageStates(boardType: WorkspaceSelection["board"]["type"], sprints: SprintSummary[], activeSprintIssuePages: IssueSummary[][], boardPage: JiraPage<JiraIssue> | undefined, backlogLoad: OptionalPageLoad): Record<string, IssuePageState> {
  const states: Record<string, IssuePageState> = {}
  const activeSprints = sprints.filter((sprint) => sprint.state === "active")
  activeSprints.forEach((sprint, index) => {
    const loaded = activeSprintIssuePages[index]?.length ?? 0
    states[sprintIssuePageSourceId(sprint.id)] = { sourceId: sprintIssuePageSourceId(sprint.id), startAt: loaded, maxResults: 50, total: loaded, isLast: true, loading: false }
  })
  for (const sprint of sprints.filter((sprint) => sprint.state === "future")) states[sprintIssuePageSourceId(sprint.id)] = defaultIssuePageState(sprintIssuePageSourceId(sprint.id))
  if (boardType === "kanban" && boardPage) states[boardIssuePageSourceId] = pageStateFromJiraPage(boardIssuePageSourceId, boardPage)
  states[backlogIssuePageSourceId] = backlogLoad.page
    ? pageStateFromJiraPage(backlogIssuePageSourceId, backlogLoad.page)
    : { ...defaultIssuePageState(backlogIssuePageSourceId), isLast: !!backlogLoad.unsupported, error: backlogLoad.error }
  return states
}

type OptionalPageLoad = {
  page?: JiraPage<JiraIssue>
  error?: string
  unsupported?: boolean
}

async function loadOptionalKanbanBacklog(auth: JiraAuthConfig, boardId: string, customFields: string[], fetchImpl: FetchLike): Promise<OptionalPageLoad> {
  try {
    return { page: await fetchBoardBacklogIssuePage(auth, boardId, fetchImpl, customFields) }
  } catch (error) {
    const unsupported = error instanceof JiraApiError && error.status === 404
    const message = error instanceof Error ? error.message : String(error)
    return { error: unsupported ? `Kanban backlog unavailable: ${message}` : `Kanban backlog load failed: ${message}`, unsupported }
  }
}

function initialIssueKeysBySource(sprints: SprintSummary[], activeSprintIssuePages: IssueSummary[][], boardIssues: IssueSummary[], backlogIssues: IssueSummary[]) {
  const keys: Record<string, string[]> = {
    [boardIssuePageSourceId]: boardIssues.map((issue) => issue.key),
    [backlogIssuePageSourceId]: backlogIssues.map((issue) => issue.key),
  }
  sprints.filter((sprint) => sprint.state === "active").forEach((sprint, index) => {
    keys[sprintIssuePageSourceId(sprint.id)] = activeSprintIssuePages[index]?.map((issue) => issue.key) ?? []
  })
  for (const sprint of sprints.filter((sprint) => sprint.state === "future")) keys[sprintIssuePageSourceId(sprint.id)] = []
  return keys
}

function pageStateFromJiraPage<T>(sourceId: string, page: JiraPage<T>): IssuePageState {
  return { sourceId, startAt: page.nextStartAt, cursor: page.cursor, maxResults: page.maxResults, total: page.total, isLast: page.isLast, loading: false }
}

function fetchIssuePage(auth: JiraAuthConfig, sourceId: string, boardId: string, startAt: number, maxResults: number, customFields: string[], fetchImpl: FetchLike) {
  if (sourceId === backlogIssuePageSourceId) return fetchBoardBacklogIssuePage(auth, boardId, fetchImpl, customFields, startAt, maxResults)
  if (sourceId === boardIssuePageSourceId) return fetchBoardIssuePage(auth, boardId, fetchImpl, customFields, startAt, maxResults)
  if (sourceId.startsWith("sprint:")) return fetchSprintIssuePage(auth, sourceId.slice("sprint:".length), fetchImpl, customFields, startAt, maxResults)
  throw new Error(`Unknown Jira issue page source ${sourceId}`)
}

export function searchJql(projectKey: string, query: string) {
  const trimmed = query.trim()
  const project = projectKey.toUpperCase()
  const fullKey = trimmed.toUpperCase().match(/^([A-Z][A-Z0-9_]*)-(\d+)$/)
  const issueKey = /^\d+$/.test(trimmed)
    ? `${project}-${trimmed}`
    : fullKey?.[1] === project ? `${fullKey[1]}-${fullKey[2]}` : undefined
  return issueKey
    ? `key = ${jqlString(issueKey)}`
    : `project = ${jqlString(projectKey)} AND text ~ ${jqlString(trimmed)} ORDER BY updated DESC`
}

export function projectListJql(projectKey: string, rankFieldUsable: boolean) {
  return `project = ${jqlString(projectKey)} ORDER BY ${rankFieldUsable ? "Rank ASC" : "updated DESC, key DESC"}`
}

export function parentHydrationJql(issueKeys: string[]) {
  return `key IN (${issueKeys.map(jqlString).join(",")}) ORDER BY key ASC`
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

async function hydrateMissingParents(auth: JiraAuthConfig, pageIssues: IssueSummary[], knownIssueKeys: string[], priorMissingParentKeys: string[], statuses: Parameters<typeof normalizeJiraIssues>[1], fieldIds: JiraIssueFieldIds, fetchImpl: FetchLike) {
  const known = new Set([...knownIssueKeys, ...pageIssues.map((issue) => issue.key)])
  const pending = uniqueStrings([...priorMissingParentKeys, ...pageIssues.flatMap((issue) => issue.parentKey ? [issue.parentKey] : [])]).filter((key) => !known.has(key))
  const hydrated: IssueSummary[] = []
  let attempted = 0

  while (pending.length && attempted < maxHydratedParents) {
    const batch = pending.splice(0, Math.min(parentHydrationChunkSize, maxHydratedParents - attempted))
    attempted += batch.length
    const page = await fetchJiraSearchIssuePage(auth, parentHydrationJql(batch), fetchImpl, issueCustomFieldIds(fieldIds), 0, batch.length)
    const parents = normalizeJiraIssues(page.items, statuses, { fieldIds })
    for (const parent of parents) {
      if (known.has(parent.key)) continue
      known.add(parent.key)
      hydrated.push(parent)
      if (parent.parentKey && !known.has(parent.parentKey) && !pending.includes(parent.parentKey)) pending.push(parent.parentKey)
    }
  }
  return hydrated
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}
