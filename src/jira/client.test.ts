import { describe, expect, test } from "bun:test"
import { fetchAccessibleProjects, fetchJiraPages, fetchProjectBoards, jiraRequest, JiraApiError } from "./client"
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
