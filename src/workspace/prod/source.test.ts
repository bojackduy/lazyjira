import { describe, expect, test } from "bun:test"
import { createProdWorkspaceSource } from "./source"

describe("prod workspace source", () => {
  test("requires auth for project discovery", async () => {
    const source = createProdWorkspaceSource(async () => undefined)

    expect(source.env).toBe("prod")
    await expect(source.fetchProjects()).rejects.toThrow("Jira credentials are required")
  })

  test("returns an explicit not-wired empty workspace for selected projects", async () => {
    const source = createProdWorkspaceSource(async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }))
    const workspace = await source.loadWorkspace({
      project: { key: "REAL", name: "Real Jira Project" },
      board: { id: "100", name: "Real Board", type: "kanban" },
    })

    expect(workspace.project.key).toBe("REAL")
    expect(Object.keys(workspace.issues)).toEqual([])
    expect(workspace.notice).toContain("Prod Jira issue loading is not wired yet")
  })
})
