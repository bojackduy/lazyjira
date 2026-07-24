import { describe, expect, test } from "bun:test"
import { createProdWorkspaceSource } from "./source"
import { backlogIssuePageSourceId, sprintIssuePageSourceId } from "../../state/issue-pages"

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

  test("loads board metadata, all active sprint issues, and bounded backlog issues", async () => {
    const requests: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        requests.push(url)
        if (url.includes("/project/REAL/statuses")) return jsonResponse([{ name: "Task", statuses: [{ id: "10000", name: "Selected for Work" }] }])
        if (url.includes("/field")) return jsonResponse([
          { id: "customfield_10020", name: "Sprint", schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" } },
          { id: "customfield_10036", name: "Story Points" },
          { id: "customfield_10016", name: "Story point estimate" },
          { id: "customfield_10019", name: "Rank" },
        ])
        if (url.includes("/status/10001")) return jsonResponse({ id: "10001", name: "Released" })
        if (url.includes("/sprint?")) return jsonResponse({ values: [
          { id: 12, state: "active", name: "Sprint 12", goal: "Load real overview data" },
          { id: 13, state: "active", name: "Sprint 13", goal: "Finish backlog loading" },
          { id: 14, state: "future", name: "Sprint 14", goal: "Later" },
        ] })
        if (url.includes("/sprint/12/issue?")) return jsonResponse({ issues: [{ key: "REAL-1", fields: { summary: "Wire active sprint", status: { id: "10000" }, issuetype: { name: "Story" }, priority: { name: "High" }, assignee: { displayName: "Duy" }, reporter: { displayName: "Mina" }, customfield_10020: [{ id: 12, state: "active", name: "Sprint 12" }], customfield_10036: 5, customfield_10019: "1|a:" } }] })
        if (url.includes("/sprint/13/issue?")) return jsonResponse({ issues: [{ key: "REAL-2", fields: { summary: "Load second active sprint", status: { id: "10000" }, issuetype: { name: "Task" }, priority: { name: "Medium" }, assignee: null, reporter: { displayName: "Mina" }, customfield_10020: [{ id: 13, state: "active", name: "Sprint 13" }], customfield_10016: 3, customfield_10019: "1|b:" } }] })
        if (url.includes("/backlog?")) return jsonResponse({ startAt: 0, maxResults: 100, total: 85, issues: [{ key: "REAL-3", fields: { summary: "Loaded board backlog", status: { id: "10000" }, issuetype: { name: "Bug" }, priority: { name: "Low" }, reporter: { displayName: "Mina" }, customfield_10016: 2, customfield_10019: "1|c:" } }] })
        return jsonResponse({ columnConfig: { columns: [{ name: "Selected", statuses: [{ id: "10000" }] }, { name: "Done", statuses: [{ id: "10001" }] }] } })
      },
    )
    const workspace = await source.loadWorkspace({
      project: { key: "REAL", name: "Real Jira Project" },
      board: { id: "100", name: "Real Board", type: "scrum" },
    })

    expect(requests.slice(0, 4)).toEqual([
      "https://team.atlassian.net/rest/agile/1.0/board/100/configuration",
      "https://team.atlassian.net/rest/api/3/project/REAL/statuses",
      "https://team.atlassian.net/rest/agile/1.0/board/100/sprint?state=active%2Cfuture&startAt=0&maxResults=50",
      "https://team.atlassian.net/rest/api/3/field",
    ])
    expect(requests[4]).toBe("https://team.atlassian.net/rest/api/2/status/10001")
    expect(requests[5]?.startsWith("https://team.atlassian.net/rest/agile/1.0/sprint/12/issue?fields=")).toBe(true)
    expect(requests[5]).toContain("customfield_10020%2Ccustomfield_10036%2Ccustomfield_10016%2Ccustomfield_10019")
    expect(requests[6]?.startsWith("https://team.atlassian.net/rest/agile/1.0/sprint/13/issue?fields=")).toBe(true)
    expect(requests[7]?.startsWith("https://team.atlassian.net/rest/agile/1.0/board/100/backlog?fields=")).toBe(true)
    expect(workspace.project.key).toBe("REAL")
    expect(workspace.statuses.map((status) => status.name)).toEqual(["Selected for Work", "Released"])
    expect(workspace.columns.map((column) => ({ name: column.name, statusIds: column.statusIds }))).toEqual([
      { name: "Selected", statusIds: ["10000"] },
      { name: "Done", statusIds: ["10001"] },
    ])
    expect(workspace.sprints).toEqual([
      { id: "12", name: "Sprint 12", goal: "Load real overview data", state: "active" },
      { id: "13", name: "Sprint 13", goal: "Finish backlog loading", state: "active" },
      { id: "14", name: "Sprint 14", goal: "Later", state: "future" },
    ])
    expect(workspace.activeSprintId).toBe("12")
    expect(Object.keys(workspace.issues)).toEqual(["REAL-1", "REAL-2", "REAL-3"])
    expect(workspace.issues["REAL-1"]?.sprintId).toBe("12")
    expect(workspace.issues["REAL-1"]?.storyPoints).toBe(5)
    expect(workspace.issues["REAL-2"]?.sprintId).toBe("13")
    expect(workspace.issues["REAL-2"]?.storyPoints).toBe(3)
    expect(workspace.issues["REAL-3"]?.sprintId).toBeUndefined()
    expect(workspace.issuePageStateBySource[backlogIssuePageSourceId]).toMatchObject({ startAt: 1, maxResults: 100, total: 85, isLast: true, loading: false })
    expect(workspace.issuePageStateBySource[sprintIssuePageSourceId("14")]).toMatchObject({ startAt: 0, maxResults: 100, isLast: false, loading: false })
    expect(workspace.selectedIssueKey).toBe("REAL-1")
    expect(workspace.notice).toContain("Prod active sprint and bounded backlog issues are loaded from Jira. Issue detail and comments load on open")
  })

  test("loads issue detail and comments", async () => {
    const requests: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        requests.push(url)
        if (url.includes("/field")) return jsonResponse([{ id: "customfield_10020", name: "Sprint", schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" } }])
        if (url.includes("/comment")) return jsonResponse({ startAt: 0, total: 1, comments: [{ id: "c1", author: { displayName: "Mina" }, body: { content: [{ content: [{ text: "Ready to test" }] }] }, updated: "2026-07-24T10:00:00.000+0000" }] })
        return jsonResponse({ key: "REAL-1", fields: { summary: "Detailed Jira issue", status: { id: "10000" }, description: { content: [{ content: [{ text: "Full issue body" }] }] }, customfield_10020: [{ id: 12, state: "active", name: "Sprint 12" }] } })
      },
    )

    const detail = await source.loadIssueDetail("REAL-1", {
      project: { key: "REAL", name: "Real Jira Project" },
      board: { id: "100", name: "Real Board", type: "scrum" },
      statuses: [{ id: "10000", name: "Selected for Work", category: "todo", color: "#94A3B8" }],
    })

    expect(requests).toContain("https://team.atlassian.net/rest/api/3/field")
    expect(requests.some((url) => url.startsWith("https://team.atlassian.net/rest/api/3/issue/REAL-1?fields="))).toBe(true)
    expect(requests).toContain("https://team.atlassian.net/rest/api/3/issue/REAL-1/comment?startAt=0&maxResults=50")
    expect(detail.issue).toMatchObject({ key: "REAL-1", title: "Detailed Jira issue", description: "Full issue body", sprintId: "12" })
    expect(detail.issue.comments).toEqual([{ id: "c1", author: "Mina", body: "Ready to test", age: "2026-07-24" }])
  })

  test("loads bounded issue pages for a source", async () => {
    const requests: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        requests.push(url)
        if (url.includes("/field")) return jsonResponse([{ id: "customfield_10020", name: "Sprint", schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" } }])
        return jsonResponse({ startAt: 100, maxResults: 50, total: 101, issues: [{ key: "REAL-101", fields: { summary: "Next backlog issue", status: { id: "10000" }, issuetype: { name: "Task" }, customfield_10020: [] } }] })
      },
    )

    const page = await source.loadIssuePage(backlogIssuePageSourceId, {
      project: { key: "REAL", name: "Real Jira Project" },
      board: { id: "100", name: "Real Board", type: "scrum" },
      statuses: [{ id: "10000", name: "Selected for Work", category: "todo", color: "#94A3B8" }],
      pageState: { sourceId: backlogIssuePageSourceId, startAt: 100, maxResults: 50, total: 101, isLast: false, loading: false },
    })

    expect(requests).toContain("https://team.atlassian.net/rest/api/3/field")
    expect(requests.some((url) => url.includes("/rest/agile/1.0/board/100/backlog?") && url.includes("&startAt=100&maxResults=50"))).toBe(true)
    expect(page.issues).toHaveLength(1)
    expect(page.issues[0]).toMatchObject({ key: "REAL-101", title: "Next backlog issue" })
    expect(page.pageState).toMatchObject({ sourceId: backlogIssuePageSourceId, startAt: 101, maxResults: 50, total: 101, isLast: true, loading: false })
  })

  test("searches Jira issues with project-scoped JQL", async () => {
    const requests: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        requests.push(url)
        if (url.includes("/field")) return jsonResponse([])
        return jsonResponse({ maxResults: 50, isLast: false, nextPageToken: "cursor-2", issues: [{ key: "REAL-7", fields: { summary: "Login remote result", status: { id: "10000" }, issuetype: { name: "Bug" } } }] })
      },
    )

    const result = await source.searchIssues("login", {
      project: { key: "REAL", name: "Real Jira Project" },
      board: { id: "100", name: "Real Board", type: "scrum" },
      statuses: [{ id: "10000", name: "Selected for Work", category: "todo", color: "#94A3B8" }],
      pageState: { sourceId: "remote-search", startAt: 0, maxResults: 50, isLast: false, loading: false },
    })

    expect(requests.some((url) => url.includes("/rest/api/3/search/jql?") && url.includes("jql=project%20%3D%20%22REAL%22%20AND%20text%20~%20%22login%22%20ORDER%20BY%20updated%20DESC"))).toBe(true)
    expect(result.issues[0]).toMatchObject({ key: "REAL-7", title: "Login remote result" })
    expect(result.pageState).toMatchObject({ sourceId: "remote-search", startAt: 1, cursor: "cursor-2", isLast: false })
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
