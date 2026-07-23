import { describe, expect, test } from "bun:test"
import { createProdWorkspaceSource } from "./source"

describe("prod workspace source", () => {
  test("requires auth for project discovery", async () => {
    const source = createProdWorkspaceSource(async () => undefined)

    expect(source.env).toBe("prod")
    await expect(source.fetchProjects()).rejects.toThrow("Jira credentials are required")
  })

  test("does not require auth for the initial no-board placeholder workspace", async () => {
    const source = createProdWorkspaceSource(async () => undefined)

    const workspace = await source.loadWorkspace({
      project: { key: "JIRA", name: "No project selected" },
      board: { id: "", name: "Choose a project", type: "kanban" },
    })

    expect(workspace.project.key).toBe("JIRA")
    expect(workspace.notice).toContain("waiting for a Jira project selection")
  })

  test("returns an explicit not-wired empty workspace for selected projects", async () => {
    const requests: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        requests.push(url)
        if (url.includes("/sprint?")) return jsonResponse({ values: [{ id: 12, state: "active", name: "Sprint 12", goal: "Load real overview data" }] })
        return jsonResponse({ columnConfig: { columns: [{ name: "Selected", statuses: [{ id: "10000" }] }, { name: "Done", statuses: [{ id: "10001" }] }] } })
      },
    )
    const workspace = await source.loadWorkspace({
      project: { key: "REAL", name: "Real Jira Project" },
      board: { id: "100", name: "Real Board", type: "kanban" },
    })

    expect(requests).toEqual([
      "https://team.atlassian.net/rest/agile/1.0/board/100/configuration",
      "https://team.atlassian.net/rest/agile/1.0/board/100/sprint?state=active%2Cfuture&startAt=0&maxResults=50",
    ])
    expect(workspace.project.key).toBe("REAL")
    expect(workspace.statuses.map((status) => status.name)).toEqual(["Selected", "Done"])
    expect(workspace.sprints).toEqual([{ id: "12", name: "Sprint 12", goal: "Load real overview data", state: "active" }])
    expect(workspace.activeSprintId).toBe("12")
    expect(Object.keys(workspace.issues)).toEqual([])
    expect(workspace.notice).toContain("Prod board metadata and sprints are loaded from Jira")
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
