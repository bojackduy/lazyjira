import { jiraBasicAuthHeader, type JiraAuthConfig } from "../auth/config"

export type JiraProjectOption = {
  id: string
  key: string
  name: string
}

export type JiraBoardOption = {
  id: string
  name: string
  type: "scrum" | "kanban"
}

export type JiraBoardConfiguration = {
  id?: number | string
  name?: string
  type?: string
  columnConfig?: {
    columns?: Array<{
      name?: string
      statuses?: Array<{
        id?: string
        self?: string
      }>
    }>
  }
}

export type JiraProjectStatusMetadata = {
  id?: string
  name?: string
  statusCategory?: {
    key?: string
    name?: string
    colorName?: string
  }
}

export type JiraProjectStatusesByIssueType = {
  id?: string
  name?: string
  statuses?: JiraProjectStatusMetadata[]
}

export type JiraSprint = {
  id?: number | string
  state?: string
  name?: string
  goal?: string
}

export type JiraField = {
  id?: string
  name?: string
  schema?: {
    type?: string
    custom?: string
    customId?: number
  }
}

export type JiraIssue = {
  id?: string
  key?: string
  fields?: {
    summary?: string
    issuetype?: { name?: string }
    priority?: { name?: string }
    status?: { id?: string; name?: string }
    assignee?: { displayName?: string } | null
    reporter?: { displayName?: string } | null
    parent?: { key?: string }
    labels?: string[]
    components?: Array<{ name?: string }>
    fixVersions?: Array<{ name?: string }>
    versions?: Array<{ name?: string }>
    description?: unknown
    issuelinks?: Array<{ outwardIssue?: { key?: string }; inwardIssue?: { key?: string } }>
    subtasks?: Array<{ key?: string }>
    created?: string
    updated?: string
    duedate?: string
    resolution?: { name?: string } | null
    [fieldId: string]: unknown
  }
}

export type JiraComment = {
  id?: string
  author?: { displayName?: string }
  body?: unknown
  created?: string
  updated?: string
}

export type JiraTransition = {
  id?: string
  name?: string
  to?: { id?: string; name?: string }
}

export type JiraEditMetadata = {
  fields?: Record<string, { allowedValues?: Array<{ id?: string; name?: string }> }>
}

export type JiraCreateIssueType = { id?: string; name?: string }

export type JiraUser = {
  accountId?: string
  displayName?: string
}


const jiraIssueFields = [
  "summary",
  "issuetype",
  "priority",
  "status",
  "assignee",
  "reporter",
  "parent",
  "labels",
  "components",
  "fixVersions",
  "versions",
  "description",
  "issuelinks",
  "subtasks",
  "created",
  "updated",
  "duedate",
  "resolution",
]

export type JiraErrorCategory = "auth" | "permission" | "not-found" | "rate-limit" | "network" | "invalid-response" | "http"

export type JiraApiErrorOptions = {
  category?: JiraErrorCategory
  endpoint?: string
  retryAfter?: string
}

export class JiraApiError extends Error {
  readonly category: JiraErrorCategory
  readonly endpoint?: string
  readonly retryAfter?: string

  constructor(readonly status: number, message: string, options: JiraApiErrorOptions = {}) {
    super(message)
    this.name = "JiraApiError"
    this.category = options.category ?? jiraErrorCategory(status)
    this.endpoint = options.endpoint
    this.retryAfter = options.retryAfter
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type JiraRequestOptions = Omit<RequestInit, "headers"> & {
  endpoint?: string
  headers?: HeadersInit
  allowEmptyBody?: boolean
}

export type JiraPaginatedResponse<T> = {
  values?: T[]
  issues?: T[]
  comments?: T[]
  startAt?: number
  nextPageToken?: string
  maxResults?: number
  total?: number
  isLast?: boolean
}

export type JiraPaginationOptions = {
  endpoint?: string
  itemKey?: "values" | "issues" | "comments"
  maxResults?: number
}

export type JiraPage<T> = {
  items: T[]
  startAt: number
  cursor?: string
  maxResults: number
  total?: number
  isLast: boolean
  nextStartAt: number
}

export async function fetchAccessibleProjects(auth: JiraAuthConfig, fetchImpl: FetchLike = fetch): Promise<JiraProjectOption[]> {
  const projects = await fetchJiraPages<ProjectSearchProject>(auth, "/rest/api/3/project/search", { endpoint: "project search" }, fetchImpl)
  return projects.flatMap((project) => {
    if (!project.id || !project.key || !project.name) return []
    return [{ id: project.id, key: project.key, name: project.name }]
  })
}

export async function fetchProjectBoards(auth: JiraAuthConfig, projectKeyOrId: string, fetchImpl: FetchLike = fetch): Promise<JiraBoardOption[]> {
  const boards = await fetchJiraPages<BoardSearchBoard>(auth, `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKeyOrId)}`, { endpoint: "board search" }, fetchImpl)
  return boards.flatMap((board) => {
    if (!board.id || !board.name || (board.type !== "scrum" && board.type !== "kanban")) return []
    return [{ id: String(board.id), name: board.name, type: board.type }]
  })
}

export async function fetchBoardConfiguration(auth: JiraAuthConfig, boardId: string, fetchImpl: FetchLike = fetch): Promise<JiraBoardConfiguration> {
  return jiraRequest<JiraBoardConfiguration>(auth, `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/configuration`, { endpoint: "board configuration" }, fetchImpl)
}

export async function fetchProjectStatuses(auth: JiraAuthConfig, projectKeyOrId: string, fetchImpl: FetchLike = fetch): Promise<JiraProjectStatusesByIssueType[]> {
  return jiraRequest<JiraProjectStatusesByIssueType[]>(auth, `/rest/api/3/project/${encodeURIComponent(projectKeyOrId)}/statuses`, { endpoint: "project statuses" }, fetchImpl)
}

export async function fetchStatusesByIds(auth: JiraAuthConfig, statusIds: string[], fetchImpl: FetchLike = fetch): Promise<JiraProjectStatusMetadata[]> {
  return Promise.all(statusIds.map((statusId) => jiraRequest<JiraProjectStatusMetadata>(auth, `/rest/api/2/status/${encodeURIComponent(statusId)}`, { endpoint: `status ${statusId}` }, fetchImpl)))
}

export async function fetchBoardSprints(auth: JiraAuthConfig, boardId: string, fetchImpl: FetchLike = fetch): Promise<JiraSprint[]> {
  return fetchJiraPages<JiraSprint>(auth, `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=${encodeURIComponent("active,future")}`, { endpoint: "board sprints" }, fetchImpl)
}

export async function fetchJiraFields(auth: JiraAuthConfig, fetchImpl: FetchLike = fetch): Promise<JiraField[]> {
  return jiraRequest<JiraField[]>(auth, "/rest/api/3/field", { endpoint: "Jira fields" }, fetchImpl)
}

export async function fetchSprintIssues(auth: JiraAuthConfig, sprintId: string, fetchImpl: FetchLike = fetch, customFields: string[] = []): Promise<JiraIssue[]> {
  return fetchJiraPages<JiraIssue>(auth, `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue?fields=${encodeURIComponent(issueFields(customFields).join(","))}`, { endpoint: `sprint ${sprintId} issues`, itemKey: "issues" }, fetchImpl)
}

export async function fetchSprintIssuePage(auth: JiraAuthConfig, sprintId: string, fetchImpl: FetchLike = fetch, customFields: string[] = [], startAt = 0, maxResults = 100): Promise<JiraPage<JiraIssue>> {
  const response = await jiraRequest<JiraPaginatedResponse<JiraIssue>>(
    auth,
    `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue?fields=${encodeURIComponent(issueFields(customFields).join(","))}&startAt=${encodeURIComponent(String(startAt))}&maxResults=${encodeURIComponent(String(maxResults))}`,
    { endpoint: `sprint ${sprintId} issue page` },
    fetchImpl,
  )
  return jiraPage(response, "issues", startAt, maxResults)
}

export async function fetchIssueDetail(auth: JiraAuthConfig, issueKey: string, fetchImpl: FetchLike = fetch, customFields: string[] = []): Promise<JiraIssue> {
  return jiraRequest<JiraIssue>(auth, `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${encodeURIComponent(issueFields(customFields).join(","))}`, { endpoint: `issue ${issueKey}` }, fetchImpl)
}

export async function fetchIssueComments(auth: JiraAuthConfig, issueKey: string, fetchImpl: FetchLike = fetch, maxResults = 50): Promise<JiraComment[]> {
  return fetchJiraPages<JiraComment>(auth, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, { endpoint: `issue ${issueKey} comments`, itemKey: "comments", maxResults }, fetchImpl)
}

export async function postJiraIssueComment(auth: JiraAuthConfig, issueKey: string, body: string, fetchImpl: FetchLike = fetch): Promise<JiraComment> {
  return jiraRequest<JiraComment>(
    auth,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
    {
      endpoint: `issue ${issueKey} comment`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: jiraDocument(body) }),
    },
    fetchImpl,
  )
}

export async function updateJiraIssue(auth: JiraAuthConfig, issueKey: string, fields: Record<string, unknown>, fetchImpl: FetchLike = fetch): Promise<void> {
  await jiraRequest<void>(
    auth,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    {
      endpoint: `issue ${issueKey} update`,
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields }),
      allowEmptyBody: true,
    },
    fetchImpl,
  )
}

export async function deleteJiraIssue(auth: JiraAuthConfig, issueKey: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await jiraRequest<void>(auth, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, { endpoint: `issue ${issueKey} delete`, method: "DELETE", allowEmptyBody: true }, fetchImpl)
}

export async function fetchJiraCreateIssueTypes(auth: JiraAuthConfig, projectKey: string, fetchImpl: FetchLike = fetch): Promise<JiraCreateIssueType[]> {
  return jiraRequest<JiraCreateIssueType[]>(auth, `/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`, { endpoint: `project ${projectKey} create issue types` }, fetchImpl)
}

export async function createJiraIssue(auth: JiraAuthConfig, fields: Record<string, unknown>, fetchImpl: FetchLike = fetch): Promise<{ key?: string }> {
  return jiraRequest<{ key?: string }>(auth, "/rest/api/3/issue", { endpoint: "create issue", method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fields }) }, fetchImpl)
}

export async function fetchJiraIssueLinkTypes(auth: JiraAuthConfig, fetchImpl: FetchLike = fetch): Promise<Array<{ name?: string }>> {
  const response = await jiraRequest<{ issueLinkTypes?: Array<{ name?: string }> }>(auth, "/rest/api/3/issueLinkType", { endpoint: "issue link types" }, fetchImpl)
  return response.issueLinkTypes ?? []
}

export async function createJiraIssueLink(auth: JiraAuthConfig, issueKey: string, targetIssueKey: string, linkType: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await jiraRequest<void>(auth, "/rest/api/3/issueLink", { endpoint: `link ${issueKey} to ${targetIssueKey}`, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: { name: linkType }, outwardIssue: { key: issueKey }, inwardIssue: { key: targetIssueKey } }), allowEmptyBody: true }, fetchImpl)
}

export async function rankJiraIssue(auth: JiraAuthConfig, issueKey: string, targetIssueKey: string, position: "before" | "after", fetchImpl: FetchLike = fetch): Promise<void> {
  await jiraRequest<void>(
    auth,
    "/rest/agile/1.0/issue/rank",
    {
      endpoint: `issue ${issueKey} rank`,
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issues: [issueKey], [position === "before" ? "rankBeforeIssue" : "rankAfterIssue"]: targetIssueKey }),
      allowEmptyBody: true,
    },
    fetchImpl,
  )
}

export async function fetchJiraIssueTransitions(auth: JiraAuthConfig, issueKey: string, fetchImpl: FetchLike = fetch): Promise<JiraTransition[]> {
  const response = await jiraRequest<{ transitions?: JiraTransition[] }>(auth, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, { endpoint: `issue ${issueKey} transitions` }, fetchImpl)
  return response.transitions ?? []
}

export async function transitionJiraIssue(auth: JiraAuthConfig, issueKey: string, transitionId: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await jiraRequest<void>(
    auth,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      endpoint: `issue ${issueKey} transition`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transition: { id: transitionId } }),
      allowEmptyBody: true,
    },
    fetchImpl,
  )
}

export async function moveJiraIssueToSprint(auth: JiraAuthConfig, issueKey: string, sprintId: string | undefined, fetchImpl: FetchLike = fetch): Promise<void> {
  const path = sprintId ? `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue` : "/rest/agile/1.0/backlog/issue"
  await jiraRequest<void>(
    auth,
    path,
    {
      endpoint: `issue ${issueKey} ${sprintId ? `move to sprint ${sprintId}` : "move to backlog"}`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ issues: [issueKey] }),
      allowEmptyBody: true,
    },
    fetchImpl,
  )
}

export async function fetchJiraIssueEditMetadata(auth: JiraAuthConfig, issueKey: string, fetchImpl: FetchLike = fetch): Promise<JiraEditMetadata> {
  return jiraRequest<JiraEditMetadata>(auth, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/editmeta`, { endpoint: `issue ${issueKey} edit metadata` }, fetchImpl)
}

export async function fetchAssignableUsers(auth: JiraAuthConfig, projectKey: string, issueKey: string, query: string, fetchImpl: FetchLike = fetch): Promise<JiraUser[]> {
  const params = new URLSearchParams({ project: projectKey, issueKey, query, maxResults: "50" })
  return jiraRequest<JiraUser[]>(auth, `/rest/api/3/user/assignable/search?${params}`, { endpoint: `assignable users for ${issueKey}` }, fetchImpl)
}

export async function fetchBoardBacklogIssues(auth: JiraAuthConfig, boardId: string, fetchImpl: FetchLike = fetch, customFields: string[] = [], maxResults = 100): Promise<JiraIssue[]> {
  return (await fetchBoardBacklogIssuePage(auth, boardId, fetchImpl, customFields, 0, maxResults)).items
}

export async function fetchBoardBacklogIssuePage(auth: JiraAuthConfig, boardId: string, fetchImpl: FetchLike = fetch, customFields: string[] = [], startAt = 0, maxResults = 100): Promise<JiraPage<JiraIssue>> {
  const response = await jiraRequest<JiraPaginatedResponse<JiraIssue>>(
    auth,
    `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/backlog?fields=${encodeURIComponent(issueFields(customFields).join(","))}&startAt=${encodeURIComponent(String(startAt))}&maxResults=${encodeURIComponent(String(maxResults))}`,
    { endpoint: "board backlog issue page" },
    fetchImpl,
  )
  return jiraPage(response, "issues", startAt, maxResults)
}

export async function fetchBoardIssuePage(auth: JiraAuthConfig, boardId: string, fetchImpl: FetchLike = fetch, customFields: string[] = [], startAt = 0, maxResults = 100): Promise<JiraPage<JiraIssue>> {
  const response = await jiraRequest<JiraPaginatedResponse<JiraIssue>>(
    auth,
    `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/issue?fields=${encodeURIComponent(issueFields(customFields).join(","))}&startAt=${encodeURIComponent(String(startAt))}&maxResults=${encodeURIComponent(String(maxResults))}`,
    { endpoint: "board issue page" },
    fetchImpl,
  )
  return jiraPage(response, "issues", startAt, maxResults)
}

export async function fetchJiraSearchIssuePage(auth: JiraAuthConfig, jql: string, fetchImpl: FetchLike = fetch, customFields: string[] = [], startAt = 0, maxResults = 50, cursor?: string): Promise<JiraPage<JiraIssue>> {
  const cursorParam = cursor ? `&nextPageToken=${encodeURIComponent(cursor)}` : ""
  const response = await jiraRequest<JiraPaginatedResponse<JiraIssue>>(
    auth,
    `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(issueFields(customFields).join(","))}&maxResults=${encodeURIComponent(String(maxResults))}${cursorParam}`,
    { endpoint: "Jira issue search" },
    fetchImpl,
  )
  return jiraPage(response, "issues", startAt, maxResults)
}

export async function fetchJiraPages<T>(auth: JiraAuthConfig, path: string, options: JiraPaginationOptions = {}, fetchImpl: FetchLike = fetch): Promise<T[]> {
  const itemKey = options.itemKey ?? "values"
  const maxResults = options.maxResults ?? 50
  const items: T[] = []
  let startAt = 0

  while (true) {
    const response = await jiraRequest<JiraPaginatedResponse<T>>(auth, paginatedPath(path, startAt, maxResults), { endpoint: options.endpoint ?? path }, fetchImpl)
    const pageItems = response[itemKey] ?? []
    items.push(...pageItems)

    const responseStartAt = typeof response.startAt === "number" ? response.startAt : startAt
    const nextStartAt = responseStartAt + pageItems.length
    if (response.isLast || !pageItems.length || (typeof response.total === "number" && nextStartAt >= response.total) || pageItems.length < maxResults) break
    startAt = nextStartAt
  }

  return items
}

export async function jiraRequest<T>(auth: JiraAuthConfig, path: string, options: JiraRequestOptions = {}, fetchImpl: FetchLike = fetch): Promise<T> {
  const { allowEmptyBody = false, endpoint = path, headers: optionHeaders, ...init } = options
  let response: Response
  try {
    response = await fetchImpl(jiraUrl(auth, path), {
      ...init,
      headers: jiraHeaders(auth, optionHeaders),
    })
  } catch (error) {
    throw new JiraApiError(0, `Jira network error for ${endpoint}: ${errorMessage(error)}`, { category: "network", endpoint })
  }

  const body = await response.text()
  const parsed = body ? parseJson(body) : undefined
  const errorJson = parsed?.ok ? parsed.value : undefined
  if (!response.ok) {
    throw new JiraApiError(response.status, jiraErrorMessage(response.status, errorJson, body, response.headers.get("retry-after") ?? undefined), {
      category: jiraErrorCategory(response.status),
      endpoint,
      retryAfter: response.headers.get("retry-after") ?? undefined,
    })
  }

  if (!body) {
    if (allowEmptyBody) return undefined as T
    throw new JiraApiError(response.status, `Jira invalid response for ${endpoint}: Expected JSON response body`, { category: "invalid-response", endpoint })
  }
  if (!parsed?.ok) throw new JiraApiError(response.status, `Jira invalid response for ${endpoint}: Expected JSON response body`, { category: "invalid-response", endpoint })
  return parsed.value as T
}

function jiraHeaders(auth: JiraAuthConfig, headers: HeadersInit | undefined) {
  const merged = new Headers(headers)
  if (!merged.has("accept")) merged.set("accept", "application/json")
  merged.set("authorization", jiraBasicAuthHeader(auth))
  return merged
}

function jiraDocument(text: string) {
  return {
    type: "doc",
    version: 1,
    content: text.replace(/\r\n/g, "\n").split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  }
}

function paginatedPath(path: string, startAt: number, maxResults: number) {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}startAt=${encodeURIComponent(String(startAt))}&maxResults=${encodeURIComponent(String(maxResults))}`
}

function issueFields(customFields: string[]) {
  return [...new Set([...jiraIssueFields, ...customFields.filter(Boolean)])]
}

function jiraPage<T>(response: JiraPaginatedResponse<T>, itemKey: "values" | "issues" | "comments", requestedStartAt: number, requestedMaxResults: number): JiraPage<T> {
  const items = response[itemKey] ?? []
  const startAt = typeof response.startAt === "number" ? response.startAt : requestedStartAt
  const maxResults = typeof response.maxResults === "number" ? response.maxResults : requestedMaxResults
  const nextStartAt = startAt + items.length
  const hasNextCursor = !!response.nextPageToken
  const isLast = !!response.isLast || !items.length || (!hasNextCursor && ((typeof response.total === "number" && nextStartAt >= response.total) || items.length < maxResults))
  return { items, startAt, cursor: response.nextPageToken, maxResults, total: response.total, isLast, nextStartAt }
}

function jiraUrl(auth: JiraAuthConfig, path: string) {
  return `${auth.baseUrl}${path.startsWith("/") ? path : `/${path}`}`
}

function parseJson(body: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(body) }
  } catch {
    return { ok: false }
  }
}

function jiraErrorMessage(status: number, json: unknown, fallback: string, retryAfter?: string) {
  if (isRecord(json)) {
    if (Array.isArray(json.errorMessages) && json.errorMessages.length) return `Jira ${status}: ${json.errorMessages.join("; ")}`
    if (typeof json.message === "string") return `Jira ${status}: ${json.message}`
  }

  switch (status) {
    case 401:
      return "Jira 401: Credentials were rejected. Run `lazyjira auth login` or update your API token."
    case 403:
      return "Jira 403: Your account does not have access to this Jira resource."
    case 404:
      return "Jira 404: Jira resource was not found or is not visible to your account."
    case 429:
      return `Jira 429: Rate limited.${retryAfter ? ` Try again after ${retryAfter} seconds.` : " Try again later."}`
    default:
      return `Jira ${status}: ${fallback || "Request failed"}`
  }
}

function jiraErrorCategory(status: number): JiraErrorCategory {
  switch (status) {
    case 0:
      return "network"
    case 401:
      return "auth"
    case 403:
      return "permission"
    case 404:
      return "not-found"
    case 429:
      return "rate-limit"
    default:
      return "http"
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

type ProjectSearchProject = { id?: string; key?: string; name?: string }

type BoardSearchBoard = { id?: number | string; name?: string; type?: string }
