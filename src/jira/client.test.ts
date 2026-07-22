import { describe, expect, test } from "bun:test"
import { fetchAccessibleProjects, fetchProjectBoards, JiraApiError } from "./client"
import type { JiraAuthConfig } from "../auth/config"

const auth: JiraAuthConfig = { baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }

describe("Jira discovery client", () => {
  test("fetches accessible projects", async () => {
    const requests: string[] = []
    const projects = await fetchAccessibleProjects(auth, async (url) => {
      requests.push(url)
      return jsonResponse({ values: [{ id: "10000", key: "PROJ", name: "Product" }] })
    })

    expect(requests).toEqual(["https://team.atlassian.net/rest/api/3/project/search"])
    expect(projects).toEqual([{ id: "10000", key: "PROJ", name: "Product" }])
  })

  test("fetches project-scoped scrum and kanban boards", async () => {
    const boards = await fetchProjectBoards(auth, "PROJ", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/agile/1.0/board?projectKeyOrId=PROJ")
      return jsonResponse({ values: [{ id: 42, name: "Product Scrum", type: "scrum" }, { id: 77, name: "Ops", type: "simple" }] })
    })

    expect(boards).toEqual([{ id: "42", name: "Product Scrum", type: "scrum" }])
  })

  test("maps Jira error responses", async () => {
    await expect(fetchAccessibleProjects(auth, async () => jsonResponse({ errorMessages: ["No access"] }, 403))).rejects.toThrow(JiraApiError)
    await expect(fetchAccessibleProjects(auth, async () => jsonResponse({ errorMessages: ["No access"] }, 403))).rejects.toThrow("Jira 403: No access")
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
