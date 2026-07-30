import { describe, expect, test } from "bun:test"
import { createDevWorkspaceSource } from "./source"
import { backlogIssuePageSourceId, boardIssuePageSourceId, projectListIssuePageSourceId } from "../../state/issue-pages"

describe("dev workspace source", () => {
  test("loads different fixture tickets per project", async () => {
    const source = createDevWorkspaceSource()
    const projects = await source.fetchProjects()

    const product = await source.loadWorkspace({ project: projects[0]!, board: (await source.fetchBoards(projects[0]!.key))[0]! })
    const mobile = await source.loadWorkspace({ project: projects[1]!, board: (await source.fetchBoards(projects[1]!.key))[0]! })
    const ops = await source.loadWorkspace({ project: projects[2]!, board: (await source.fetchBoards(projects[2]!.key))[0]! })

    expect(Object.keys(product.issues).some((key) => key.startsWith("PROJ-"))).toBe(true)
    expect(Object.keys(mobile.issues).every((key) => key.startsWith("MOB-"))).toBe(true)
    expect(Object.keys(ops.issues).every((key) => key.startsWith("OPS-"))).toBe(true)
  })

  test("provides deterministic disjoint Kanban board and backlog membership", async () => {
    const source = createDevWorkspaceSource()
    const project = (await source.fetchProjects())[0]!
    const workspace = await source.loadWorkspace({ project, board: (await source.fetchBoards(project.key))[0]! })

    expect(workspace.issueKeysBySource[boardIssuePageSourceId]?.length).toBeGreaterThan(0)
    expect(workspace.issueKeysBySource[backlogIssuePageSourceId]?.length).toBeGreaterThan(0)
    expect(workspace.issueKeysBySource[boardIssuePageSourceId]?.some((key) => workspace.issueKeysBySource[backlogIssuePageSourceId]?.includes(key))).toBe(false)
  })

  test("loads deterministic bounded project List pages without Jira credentials", async () => {
    const source = createDevWorkspaceSource()
    const project = (await source.fetchProjects())[0]!
    const context = {
      project,
      board: (await source.fetchBoards(project.key))[0]!,
      statuses: [{ id: "todo", name: "To Do", category: "todo" as const, color: "#fff" }],
      pageState: { sourceId: projectListIssuePageSourceId, startAt: 0, maxResults: 2, isLast: false, loading: false },
    }

    const first = await source.loadIssuePage(projectListIssuePageSourceId, context)
    const second = await source.loadIssuePage(projectListIssuePageSourceId, { ...context, pageState: first.pageState })

    expect(first.issues.map((issue) => issue.key)).toEqual(["PROJ-101", "PROJ-121"])
    expect(second.issues.map((issue) => issue.key)).toEqual(["PROJ-128", "PROJ-142"])
    expect(first.pageState).toMatchObject({ startAt: 2, maxResults: 2, isLast: false })
    expect(first.sort).toBe("rank")
  })
})
