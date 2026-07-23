import { describe, expect, test } from "bun:test"
import { fetchAccessibleProjects, fetchBoardConfiguration, fetchBoardSprints, fetchJiraPages, fetchProjectBoards, fetchSprintIssues, jiraRequest, JiraApiError } from "./client"
import { normalizeBoardConfiguration, normalizeBoardSprints, normalizeSprintIssues } from "./normalize"
import type { JiraAuthConfig } from "../auth/config"

const auth: JiraAuthConfig = { baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }

describe("Jira discovery client", () => {
  test("fetches accessible projects", async () => {
    const requests: string[] = []
    const projects = await fetchAccessibleProjects(auth, async (url) => {
      requests.push(url)
      return jsonResponse({ values: [{ id: "10000", key: "PROJ", name: "Product" }] })
    })

    expect(requests).toEqual(["https://team.atlassian.net/rest/api/3/project/search?startAt=0&maxResults=50"])
    expect(projects).toEqual([{ id: "10000", key: "PROJ", name: "Product" }])
  })

  test("fetches project-scoped scrum and kanban boards", async () => {
    const boards = await fetchProjectBoards(auth, "PROJ", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/agile/1.0/board?projectKeyOrId=PROJ&startAt=0&maxResults=50")
      return jsonResponse({ values: [{ id: 42, name: "Product Scrum", type: "scrum" }, { id: 77, name: "Ops", type: "simple" }] })
    })

    expect(boards).toEqual([{ id: "42", name: "Product Scrum", type: "scrum" }])
  })

  test("fetches board configuration", async () => {
    const config = await fetchBoardConfiguration(auth, "42", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/agile/1.0/board/42/configuration")
      return jsonResponse({ id: 42, name: "Product Scrum", columnConfig: { columns: [{ name: "To Do", statuses: [{ id: "10000" }] }] } })
    })

    expect(config.columnConfig?.columns?.[0]?.name).toBe("To Do")
  })

  test("fetches active and future board sprints", async () => {
    const requests: string[] = []
    const sprints = await fetchBoardSprints(auth, "42", async (url) => {
      requests.push(url)
      return jsonResponse({ values: [{ id: 7, state: "active", name: "Sprint 7", goal: "Ship board metadata" }] })
    })

    expect(requests).toEqual(["https://team.atlassian.net/rest/agile/1.0/board/42/sprint?state=active%2Cfuture&startAt=0&maxResults=50"])
    expect(sprints).toEqual([{ id: 7, state: "active", name: "Sprint 7", goal: "Ship board metadata" }])
  })

  test("fetches active sprint issues", async () => {
    const requests: string[] = []
    const issues = await fetchSprintIssues(auth, "7", async (url) => {
      requests.push(url)
      return jsonResponse({ issues: [{ key: "PROJ-1", fields: { summary: "Load active sprint" } }] })
    })

    expect(requests[0]?.startsWith("https://team.atlassian.net/rest/agile/1.0/sprint/7/issue?fields=")).toBe(true)
    expect(requests[0]).toContain("&startAt=0&maxResults=50")
    expect(issues).toEqual([{ key: "PROJ-1", fields: { summary: "Load active sprint" } }])
  })

  test("normalizes board columns into app statuses", () => {
    const metadata = normalizeBoardConfiguration({
      columnConfig: {
        columns: [
          { name: "To Do", statuses: [{ id: "10000" }] },
          { name: "In Progress", statuses: [{ id: "3" }, { id: "10001" }] },
          { name: "Done", statuses: [{ id: "10002" }] },
        ],
      },
    })

    expect(metadata.columns.map((column) => column.name)).toEqual(["To Do", "In Progress", "Done"])
    expect(metadata.statuses).toEqual([
      { id: "10000", name: "To Do", category: "todo", color: "#64748B" },
      { id: "3", name: "In Progress 1", category: "in-progress", color: "#38BDF8" },
      { id: "10001", name: "In Progress 2", category: "in-progress", color: "#38BDF8" },
      { id: "10002", name: "Done", category: "done", color: "#22C55E" },
    ])
  })

  test("normalizes board sprints", () => {
    const sprints = normalizeBoardSprints([
      { id: 7, state: "active", name: "Sprint 7", goal: "Finish read path" },
      { id: "8", state: "future", name: "Sprint 8" },
      { id: 9, state: "unknown", name: "Ignored" },
    ])

    expect(sprints).toEqual([
      { id: "7", name: "Sprint 7", goal: "Finish read path", state: "active" },
      { id: "8", name: "Sprint 8", goal: "", state: "future" },
    ])
  })

  test("normalizes active sprint issues", () => {
    const issues = normalizeSprintIssues([
      {
        key: "PROJ-1",
        fields: {
          summary: "Load active sprint",
          issuetype: { name: "Story" },
          priority: { name: "High" },
          status: { id: "10001", name: "In Progress" },
          assignee: { displayName: "Duy" },
          reporter: { displayName: "Mina" },
          labels: ["frontend"],
          components: [{ name: "TUI" }],
          fixVersions: [{ name: "2026.08" }],
          versions: [{ name: "2026.07" }],
          description: { content: [{ content: [{ text: "Read Jira issues" }] }] },
          issuelinks: [{ outwardIssue: { key: "PROJ-2" } }],
          subtasks: [{ key: "PROJ-3" }],
          created: "2026-07-01T00:00:00.000+0000",
          updated: "2026-07-02T00:00:00.000+0000",
          duedate: "2026-08-01",
        },
      },
    ], "7", [{ id: "10001", name: "In Progress", category: "in-progress", color: "#38BDF8" }])

    expect(issues[0]).toMatchObject({
      key: "PROJ-1",
      title: "Load active sprint",
      type: "Story",
      priority: "High",
      statusId: "10001",
      assignee: "Duy",
      reporter: "Mina",
      sprintId: "7",
      labels: ["frontend"],
      components: ["TUI"],
      fixVersions: ["2026.08"],
      affectsVersions: ["2026.07"],
      description: "Read Jira issues",
      links: ["PROJ-2", "PROJ-3"],
    })
  })

  test("sends Jira auth and JSON headers", async () => {
    let headers = new Headers()
    const response = await jiraRequest<{ ok: boolean }>(auth, "/rest/api/3/myself", {}, async (_url, init) => {
      headers = new Headers(init?.headers)
      return jsonResponse({ ok: true })
    })

    expect(response).toEqual({ ok: true })
    expect(headers.get("accept")).toBe("application/json")
    expect(headers.get("authorization")).toBe("Basic ZHV5QGV4YW1wbGUuY29tOnRva2Vu")
  })

  test("allows explicit empty success responses", async () => {
    const response = await jiraRequest<void>(auth, "/rest/api/3/empty", { allowEmptyBody: true }, async () => new Response("", { status: 204 }))

    expect(response).toBeUndefined()
  })

  test("rejects invalid success JSON as an invalid response", async () => {
    const error = await expectJiraError(() => jiraRequest(auth, "/rest/api/3/bad", { endpoint: "bad endpoint" }, async () => textResponse("not-json")))

    expect(error.status).toBe(200)
    expect(error.category).toBe("invalid-response")
    expect(error.endpoint).toBe("bad endpoint")
    expect(error.message).toContain("Expected JSON response body")
  })

  test("fetches paginated Jira values", async () => {
    const requests: string[] = []
    const values = await fetchJiraPages<{ id: string }>(auth, "/rest/api/3/project/search", { maxResults: 2 }, async (url) => {
      requests.push(url)
      if (url.endsWith("startAt=0&maxResults=2")) return jsonResponse({ startAt: 0, total: 3, values: [{ id: "1" }, { id: "2" }] })
      return jsonResponse({ startAt: 2, total: 3, values: [{ id: "3" }] })
    })

    expect(requests).toEqual([
      "https://team.atlassian.net/rest/api/3/project/search?startAt=0&maxResults=2",
      "https://team.atlassian.net/rest/api/3/project/search?startAt=2&maxResults=2",
    ])
    expect(values).toEqual([{ id: "1" }, { id: "2" }, { id: "3" }])
  })

  test("maps Jira error responses", async () => {
    const error = await expectJiraError(() => fetchAccessibleProjects(auth, async () => jsonResponse({ errorMessages: ["No access"] }, 403)))

    expect(error.status).toBe(403)
    expect(error.category).toBe("permission")
    expect(error.endpoint).toBe("project search")
    expect(error.message).toBe("Jira 403: No access")
  })

  test("maps common Jira status categories", async () => {
    const authError = await expectJiraError(() => jiraRequest(auth, "/rest/api/3/myself", {}, async () => textResponse("", 401)))
    const notFoundError = await expectJiraError(() => jiraRequest(auth, "/rest/api/3/issue/NOPE-1", {}, async () => textResponse("", 404)))
    const rateLimitError = await expectJiraError(() => jiraRequest(auth, "/rest/api/3/search/jql", {}, async () => textResponse("", 429, { "retry-after": "30" })))

    expect(authError.category).toBe("auth")
    expect(authError.message).toContain("update your API token")
    expect(notFoundError.category).toBe("not-found")
    expect(rateLimitError.category).toBe("rate-limit")
    expect(rateLimitError.retryAfter).toBe("30")
    expect(rateLimitError.message).toContain("Try again after 30 seconds")
  })

  test("maps network failures", async () => {
    const error = await expectJiraError(() => jiraRequest(auth, "/rest/api/3/myself", {}, async () => {
      throw new Error("offline")
    }))

    expect(error.status).toBe(0)
    expect(error.category).toBe("network")
    expect(error.endpoint).toBe("/rest/api/3/myself")
    expect(error.message).toContain("offline")
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

function textResponse(body: string, status = 200, headers?: HeadersInit) {
  return new Response(body, { status, headers })
}

async function expectJiraError(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    expect(error).toBeInstanceOf(JiraApiError)
    return error as JiraApiError
  }
  throw new Error("Expected JiraApiError")
}
