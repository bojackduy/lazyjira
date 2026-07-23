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
  startAt?: number
  maxResults?: number
  total?: number
  isLast?: boolean
}

export type JiraPaginationOptions = {
  endpoint?: string
  itemKey?: "values" | "issues"
  maxResults?: number
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

function paginatedPath(path: string, startAt: number, maxResults: number) {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}startAt=${encodeURIComponent(String(startAt))}&maxResults=${encodeURIComponent(String(maxResults))}`
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
