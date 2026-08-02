import { describe, expect, test } from "bun:test"
import { createDevWorkspaceSource } from "./source"
import { backlogIssuePageSourceId, boardIssuePageSourceId, projectListIssuePageSourceId } from "../../state/issue-pages"

describe("dev workspace source", () => {
  test("loads different fixture tickets per project", async () => {
    const source = createDevWorkspaceSource()
    const projects = (await source.fetchProjectPage({ query: "", startAt: 0, maxResults: 50 })).items

    const product = await source.loadWorkspace({ project: projects[0]!, board: (await source.fetchBoards(projects[0]!.key))[0]! })
    const mobile = await source.loadWorkspace({ project: projects[1]!, board: (await source.fetchBoards(projects[1]!.key))[0]! })
    const ops = await source.loadWorkspace({ project: projects[2]!, board: (await source.fetchBoards(projects[2]!.key))[0]! })

    expect(Object.keys(product.issues).some((key) => key.startsWith("PROJ-"))).toBe(true)
    expect(Object.keys(mobile.issues).every((key) => key.startsWith("MOB-"))).toBe(true)
    expect(Object.keys(ops.issues).every((key) => key.startsWith("OPS-"))).toBe(true)
  })

  test("provides deterministic disjoint Kanban board and backlog membership", async () => {
    const source = createDevWorkspaceSource()
    const project = (await source.fetchProjectPage({ query: "", startAt: 0, maxResults: 50 })).items[0]!
    const workspace = await source.loadWorkspace({ project, board: (await source.fetchBoards(project.key))[0]! })

    expect(workspace.issueKeysBySource[boardIssuePageSourceId]?.length).toBeGreaterThan(0)
    expect(workspace.issueKeysBySource[backlogIssuePageSourceId]?.length).toBeGreaterThan(0)
    expect(workspace.issueKeysBySource[boardIssuePageSourceId]?.some((key) => workspace.issueKeysBySource[backlogIssuePageSourceId]?.includes(key))).toBe(false)
  })

  test("loads deterministic bounded project List pages without Jira credentials", async () => {
    const source = createDevWorkspaceSource()
    const project = (await source.fetchProjectPage({ query: "", startAt: 0, maxResults: 50 })).items[0]!
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

  test("pages and searches projects like the production source", async () => {
    const source = createDevWorkspaceSource()

    const first = await source.fetchProjectPage({ query: "", startAt: 0, maxResults: 2 })
    const second = await source.fetchProjectPage({ query: "", startAt: 2, maxResults: 2 })
    const search = await source.fetchProjectPage({ query: "mobile", startAt: 0, maxResults: 50 })

    expect(first).toMatchObject({ startAt: 0, maxResults: 2, total: 3, isLast: false })
    expect(first.items.map((project) => project.key)).toEqual(["PROJ", "MOB"])
    expect(second.items.map((project) => project.key)).toEqual(["OPS"])
    expect(search.items.map((project) => project.key)).toEqual(["MOB"])
  })

  test("provides deterministic Priority choices for Inspector editing", async () => {
    const options = await createDevWorkspaceSource().loadIssueFieldOptions("priority", "PROJ-128")

    expect(options.map((option) => option.value)).toEqual(["Critical", "Medium", "High", "Low"])
  })

  test("provides deterministic label suggestions for Inspector editing", async () => {
    const options = await createDevWorkspaceSource().loadIssueFieldOptions("labels", "PROJ-128")

    expect(options.map((option) => option.value)).toContain("auth")
    expect(options.map((option) => option.value)).toContain("release-blocker")
  })
})
