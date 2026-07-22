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

export class JiraApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = "JiraApiError"
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export async function fetchAccessibleProjects(auth: JiraAuthConfig, fetchImpl: FetchLike = fetch): Promise<JiraProjectOption[]> {
  const response = await jiraRequest<ProjectSearchResponse>(auth, "/rest/api/3/project/search", fetchImpl)
  return (response.values ?? []).flatMap((project) => {
    if (!project.id || !project.key || !project.name) return []
    return [{ id: project.id, key: project.key, name: project.name }]
  })
}

export async function fetchProjectBoards(auth: JiraAuthConfig, projectKeyOrId: string, fetchImpl: FetchLike = fetch): Promise<JiraBoardOption[]> {
  const response = await jiraRequest<BoardSearchResponse>(auth, `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKeyOrId)}`, fetchImpl)
  return (response.values ?? []).flatMap((board) => {
    if (!board.id || !board.name || (board.type !== "scrum" && board.type !== "kanban")) return []
    return [{ id: String(board.id), name: board.name, type: board.type }]
  })
}

async function jiraRequest<T>(auth: JiraAuthConfig, path: string, fetchImpl: FetchLike): Promise<T> {
  const response = await fetchImpl(jiraUrl(auth, path), {
    headers: {
      accept: "application/json",
      authorization: jiraBasicAuthHeader(auth),
    },
  })
  const body = await response.text()
  const json = body ? parseJson(body) : undefined
  if (!response.ok) throw new JiraApiError(response.status, jiraErrorMessage(response.status, json, body))
  return json as T
}

function jiraUrl(auth: JiraAuthConfig, path: string) {
  return `${auth.baseUrl}${path.startsWith("/") ? path : `/${path}`}`
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

function jiraErrorMessage(status: number, json: unknown, fallback: string) {
  if (isRecord(json)) {
    if (Array.isArray(json.errorMessages) && json.errorMessages.length) return `Jira ${status}: ${json.errorMessages.join("; ")}`
    if (typeof json.message === "string") return `Jira ${status}: ${json.message}`
  }
  return `Jira ${status}: ${fallback || "Request failed"}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

type ProjectSearchResponse = {
  values?: Array<{ id?: string; key?: string; name?: string }>
}

type BoardSearchResponse = {
  values?: Array<{ id?: number | string; name?: string; type?: string }>
}
