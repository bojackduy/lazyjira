import { describe, expect, test } from "bun:test"
import { createProdWorkspaceSource, parentHydrationJql, projectListJql, searchJql } from "./source"
import { backlogIssuePageSourceId, boardIssuePageSourceId, projectListIssuePageSourceId, sprintIssuePageSourceId } from "../../state/issue-pages"

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
        if (url.endsWith("/rest/api/3/myself")) return jsonResponse({ accountId: "me-1", displayName: "Duy Trinh" })
        if (url.includes("/project/REAL/statuses")) return jsonResponse([{ name: "Task", statuses: [{ id: "10000", name: "Selected for Work" }] }])
        if (url.includes("/issue/createmeta/REAL/issuetypes")) return jsonResponse({ values: [
          { id: "10001", name: "Story", hierarchyLevel: 0 },
          { id: "10002", name: "Sub-task", hierarchyLevel: -1, subtask: true },
        ] })
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

    expect(requests.slice(0, 5)).toEqual([
      "https://team.atlassian.net/rest/agile/1.0/board/100/configuration",
      "https://team.atlassian.net/rest/api/3/project/REAL/statuses",
      "https://team.atlassian.net/rest/api/3/issue/createmeta/REAL/issuetypes",
      "https://team.atlassian.net/rest/agile/1.0/board/100/sprint?state=active%2Cfuture&startAt=0&maxResults=50",
      "https://team.atlassian.net/rest/api/3/field",
    ])
    expect(requests[5]).toBe("https://team.atlassian.net/rest/api/3/myself")
    expect(requests[6]).toBe("https://team.atlassian.net/rest/api/2/status/10001")
    expect(requests[7]?.startsWith("https://team.atlassian.net/rest/agile/1.0/sprint/12/issue?fields=")).toBe(true)
    expect(requests[7]).toContain("customfield_10020%2Ccustomfield_10036%2Ccustomfield_10016%2Ccustomfield_10019")
    expect(requests[8]?.startsWith("https://team.atlassian.net/rest/agile/1.0/sprint/13/issue?fields=")).toBe(true)
    expect(requests[9]?.startsWith("https://team.atlassian.net/rest/agile/1.0/board/100/backlog?fields=")).toBe(true)
    expect(workspace.project.key).toBe("REAL")
    expect(workspace).toMatchObject({ currentUser: "Duy Trinh", currentUserAccountId: "me-1" })
    expect(workspace.statuses.map((status) => status.name)).toEqual(["Selected for Work", "Released"])
    expect(workspace.issueTypes).toMatchObject([{ id: "10001", name: "Story", hierarchyLevel: 0 }, { id: "10002", name: "Sub-task", subtask: true }])
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

  test("loads distinct bounded Kanban board and backlog pages", async () => {
    const requests: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        requests.push(url)
        if (url.includes("/project/KAN/statuses")) return jsonResponse([{ name: "Task", statuses: [{ id: "1", name: "Selected" }] }])
        if (url.includes("/issue/createmeta/KAN/issuetypes")) return jsonResponse({ values: [{ id: "10001", name: "Task" }] })
        if (url.endsWith("/field")) return jsonResponse([])
        if (url.includes("/board/200/backlog?")) return jsonResponse({ startAt: 0, maxResults: 1, total: 12, issues: [{ key: "KAN-BACKLOG", fields: { summary: "Kanban backlog issue", status: { id: "1" }, issuetype: { name: "Task" } } }] })
        if (url.includes("/board/200/issue?")) return jsonResponse({ startAt: 0, maxResults: 1, total: 240, issues: [{ key: "KAN-BOARD", fields: { summary: "Bounded Kanban issue", status: { id: "1" }, issuetype: { name: "Task" } } }] })
        return jsonResponse({ columnConfig: { columns: [{ name: "Selected", statuses: [{ id: "1" }] }] } })
      },
    )

    const workspace = await source.loadWorkspace({
      project: { key: "KAN", name: "Kanban Project" },
      board: { id: "200", name: "Delivery Kanban", type: "kanban" },
    })

    expect(requests.some((url) => url.includes("/sprint?"))).toBe(false)
    expect(requests.some((url) => url.includes("/board/200/backlog?"))).toBe(true)
    expect(requests.some((url) => url.includes("/board/200/issue?"))).toBe(true)
    expect(workspace.issues["KAN-BOARD"]?.title).toBe("Bounded Kanban issue")
    expect(workspace.issues["KAN-BACKLOG"]?.title).toBe("Kanban backlog issue")
    expect(workspace.issueKeysBySource[boardIssuePageSourceId]).toEqual(["KAN-BOARD"])
    expect(workspace.issueKeysBySource[backlogIssuePageSourceId]).toEqual(["KAN-BACKLOG"])
    expect(workspace.issuePageStateBySource[boardIssuePageSourceId]).toMatchObject({ startAt: 1, total: 240, isLast: false, loading: false })
    expect(workspace.issuePageStateBySource[backlogIssuePageSourceId]).toMatchObject({ startAt: 1, total: 12, isLast: false, loading: false })
  })

  test("keeps Kanban board usable when the optional backlog endpoint is unavailable", async () => {
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        if (url.includes("/project/KAN/statuses")) return jsonResponse([{ name: "Task", statuses: [{ id: "1", name: "Selected" }] }])
        if (url.includes("/issue/createmeta/KAN/issuetypes")) return jsonResponse({ values: [{ id: "10001", name: "Task" }] })
        if (url.endsWith("/field")) return jsonResponse([])
        if (url.includes("/board/200/backlog?")) return jsonResponse({ errorMessages: ["Backlog is disabled"] }, 404)
        if (url.includes("/board/200/issue?")) return jsonResponse({ startAt: 0, maxResults: 1, total: 1, issues: [{ key: "KAN-BOARD", fields: { summary: "Board remains available", status: { id: "1" }, issuetype: { name: "Task" } } }] })
        return jsonResponse({ columnConfig: { columns: [{ name: "Selected", statuses: [{ id: "1" }] }] } })
      },
    )

    const workspace = await source.loadWorkspace({
      project: { key: "KAN", name: "Kanban Project" },
      board: { id: "200", name: "Delivery Kanban", type: "kanban" },
    })

    expect(workspace.issueKeysBySource[boardIssuePageSourceId]).toEqual(["KAN-BOARD"])
    expect(workspace.issueKeysBySource[backlogIssuePageSourceId]).toEqual([])
    expect(workspace.issuePageStateBySource[boardIssuePageSourceId]).toMatchObject({ isLast: true })
    expect(workspace.issuePageStateBySource[boardIssuePageSourceId]?.error).toBeUndefined()
    expect(workspace.issuePageStateBySource[backlogIssuePageSourceId]).toMatchObject({ isLast: true })
    expect(workspace.issuePageStateBySource[backlogIssuePageSourceId]?.error).toContain("Kanban backlog unavailable: Jira 404")
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

  test("posts a comment through the prod source", async () => {
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url, init) => {
        expect(url).toBe("https://team.atlassian.net/rest/api/3/issue/REAL-1/comment")
        expect(init?.method).toBe("POST")
        return jsonResponse({ id: "10001" }, 201)
      },
    )

    await source.postIssueComment("REAL-1", "Ready for review")
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

  test("searches numeric and full current-project issue keys exactly", () => {
    expect(searchJql("HPCE", "1812")).toBe('key = "HPCE-1812"')
    expect(searchJql("HPCE", "hpce-1812")).toBe('key = "HPCE-1812"')
    expect(searchJql("HPCE", "asset library")).toBe('project = "HPCE" AND text ~ "asset library" ORDER BY updated DESC')
  })

  test("escapes project List JQL and uses the documented ordering fallback", () => {
    expect(projectListJql('PR"OJ\\X', true)).toBe('project = "PR\\"OJ\\\\X" ORDER BY Rank ASC')
    expect(projectListJql("PROJ", false)).toBe('project = "PROJ" ORDER BY updated DESC, key DESC')
  })

  test("escapes parent hydration JQL values", () => {
    expect(parentHydrationJql(['PROJ-1', 'PR"OJ\\2'])).toBe('key IN ("PROJ-1","PR\\"OJ\\\\2") ORDER BY key ASC')
  })

  test("loads project List through enhanced search with its independent cursor and fields", async () => {
    const requests: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        requests.push(url)
        if (url.endsWith("/rest/api/3/field")) return jsonResponse([
          { id: "customfield_10020", name: "Sprint", schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" } },
          { id: "customfield_10036", name: "Story Points" },
          { id: "customfield_10019", name: "Rank" },
        ])
        return jsonResponse({ nextPageToken: "list-cursor-2", maxResults: 50, total: 80, issues: [{ key: "REAL-51", fields: { summary: "Project issue", status: { id: "10000" }, issuetype: { name: "Story" }, duedate: "2026-08-03", customfield_10020: [{ id: 7, state: "active" }], customfield_10036: 5 } }] })
      },
    )

    const result = await source.loadIssuePage(projectListIssuePageSourceId, {
      project: { key: "REAL", name: "Real Jira Project" },
      board: { id: "100", name: "Real Board", type: "scrum" },
      statuses: [{ id: "10000", name: "To Do", category: "todo", color: "#fff" }],
      pageState: { sourceId: projectListIssuePageSourceId, startAt: 50, cursor: "list-cursor-1", maxResults: 50, total: 80, isLast: false, loading: false },
    })

    const request = requests.find((url) => url.includes("/rest/api/3/search/jql?"))!
    expect(request).toContain("jql=project%20%3D%20%22REAL%22%20ORDER%20BY%20Rank%20ASC")
    expect(request).toContain("nextPageToken=list-cursor-1")
    expect(request).toContain("customfield_10020%2Ccustomfield_10036%2Ccustomfield_10019")
    expect(result.issues[0]).toMatchObject({ key: "REAL-51", dueDate: "2026-08-03", sprintId: "7", storyPoints: 5 })
    expect(result.pageState).toMatchObject({ sourceId: projectListIssuePageSourceId, startAt: 51, cursor: "list-cursor-2", total: 80, isLast: false })
    expect(result.sort).toBe("rank")
  })

  test("hydrates missing parents in bounded batches without per-row requests", async () => {
    const searchJqls: string[] = []
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        if (url.endsWith("/rest/api/3/field")) return jsonResponse([
          { id: "customfield_start", name: "Start date", schema: { type: "date" } },
        ])
        const jql = new URL(url).searchParams.get("jql") ?? ""
        searchJqls.push(jql)
        if (jql.startsWith("project =")) {
          return jsonResponse({ total: 51, isLast: true, issues: Array.from({ length: 51 }, (_, index) => ({
            key: `REAL-C${index + 1}`,
            fields: { summary: `Child ${index + 1}`, status: { id: "todo" }, parent: { key: `REAL-P${index + 1}` }, customfield_start: "2026-08-01" },
          })) })
        }
        const keys = [...jql.matchAll(/"(REAL-P\d+)"/g)].map((match) => match[1]!)
        return jsonResponse({ total: keys.length, isLast: true, issues: keys.map((key) => ({ key, fields: { summary: key, status: { id: "todo" } } })) })
      },
    )

    const result = await source.loadIssuePage(projectListIssuePageSourceId, {
      project: { key: "REAL", name: "Real" },
      board: { id: "1", name: "Board", type: "kanban" },
      statuses: [{ id: "todo", name: "To Do", category: "todo", color: "#fff" }],
      pageState: { sourceId: projectListIssuePageSourceId, startAt: 0, maxResults: 51, isLast: false, loading: false },
      knownIssueKeys: [],
    })

    expect(searchJqls.filter((jql) => jql.startsWith("key IN"))).toHaveLength(3)
    expect(result.relatedIssues).toHaveLength(51)
    expect(result.timelineStartDateField).toEqual({ status: "available", fieldId: "customfield_start" })
    expect(result.issues[0]?.startDate).toBe("2026-08-01")
  })

  test("returns project List rows when parent hydration fails", async () => {
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        if (url.endsWith("/rest/api/3/field")) return jsonResponse([])
        const jql = new URL(url).searchParams.get("jql") ?? ""
        if (jql.startsWith("project =")) return jsonResponse({ total: 1, isLast: true, issues: [{ key: "REAL-2", fields: { summary: "Child", status: { id: "todo" }, parent: { key: "REAL-1" } } }] })
        return jsonResponse({ errorMessages: ["No parent access"] }, 403)
      },
    )

    const result = await source.loadIssuePage(projectListIssuePageSourceId, {
      project: { key: "REAL", name: "Real" },
      board: { id: "1", name: "Board", type: "kanban" },
      statuses: [{ id: "todo", name: "To Do", category: "todo", color: "#fff" }],
      pageState: { sourceId: projectListIssuePageSourceId, startAt: 0, maxResults: 50, isLast: false, loading: false },
    })

    expect(result.issues.map((issue) => issue.key)).toEqual(["REAL-2"])
    expect(result.parentHydrationError).toContain("Parent hydration failed")
  })

  test("caps attempted parent hydration keys when Jira returns no parents", async () => {
    let parentSearches = 0
    const source = createProdWorkspaceSource(
      async () => ({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }),
      async (url) => {
        if (url.endsWith("/rest/api/3/field")) return jsonResponse([])
        const jql = new URL(url).searchParams.get("jql") ?? ""
        if (jql.startsWith("project =")) return jsonResponse({ total: 225, isLast: true, issues: [] })
        parentSearches += 1
        return jsonResponse({ total: 0, isLast: true, issues: [] })
      },
    )

    await source.loadIssuePage(projectListIssuePageSourceId, {
      project: { key: "REAL", name: "Real" },
      board: { id: "1", name: "Board", type: "kanban" },
      statuses: [{ id: "todo", name: "To Do", category: "todo", color: "#fff" }],
      pageState: { sourceId: projectListIssuePageSourceId, startAt: 0, maxResults: 50, isLast: false, loading: false },
      knownIssueKeys: [],
      missingParentKeys: Array.from({ length: 225 }, (_, index) => `REAL-P${index + 1}`),
    })

    expect(parentSearches).toBe(8)
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
