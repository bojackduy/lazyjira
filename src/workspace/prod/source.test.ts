import { describe, expect, test } from "bun:test"
import { createProdWorkspaceSource } from "./source"

describe("prod workspace source", () => {
  test("requires auth for project discovery", async () => {
    const source = createProdWorkspaceSource(async () => undefined)

    expect(source.env).toBe("prod")
    await expect(source.fetchProjects()).rejects.toThrow("Jira credentials are required")
  })

  test("returns an explicit not-wired empty workspace for selected projects", async () => {
    const requests: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        requests.push(url)
        return jsonResponse({ columnConfig: { columns: [{ name: "Selected", statuses: [{ id: "10000" }] }, { name: "Done", statuses: [{ id: "10001" }] }] } })
      },
    )
    const workspace = await source.loadWorkspace({
      project: { key: "REAL", name: "Real Jira Project" },
      board: { id: "100", name: "Real Board", type: "kanban" },
    })

    expect(requests).toEqual(["https://team.atlassian.net/rest/agile/1.0/board/100/configuration"])
    expect(workspace.project.key).toBe("REAL")
    expect(workspace.statuses.map((status) => status.name)).toEqual(["Selected", "Done"])
    expect(Object.keys(workspace.issues)).toEqual([])
    expect(workspace.notice).toContain("Prod board metadata is loaded from Jira")
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
