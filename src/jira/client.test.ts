import { describe, expect, test } from "bun:test"
import { deleteJiraIssue, fetchAccessibleProjectPage, fetchBoardBacklogIssuePage, fetchBoardBacklogIssues, fetchBoardConfiguration, fetchBoardIssuePage, fetchBoardSprints, fetchIssueComments, fetchIssueDetail, fetchJiraFields, fetchJiraIssueEditMetadata, fetchJiraIssueTransitions, fetchJiraPages, fetchJiraSearchIssuePage, fetchProjectBoards, fetchProjectIssueTypes, fetchProjectStatuses, fetchSprintIssuePage, fetchSprintIssues, fetchStatusesByIds, jiraRequest, JiraApiError, moveJiraIssueToSprint, postJiraIssueComment, rankJiraIssue, transitionJiraIssue, updateJiraIssue } from "./client"
import { discoverJiraIssueFieldIds, discoverJiraStartDateField, mergeIssueDetail, normalizeBoardConfiguration, normalizeBoardSprints, normalizeJiraComments, normalizeJiraIssues, normalizeProjectStatuses, normalizeSprintIssues } from "./normalize"
import type { JiraAuthConfig } from "../auth/config"

const auth: JiraAuthConfig = { baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }

describe("Jira discovery client", () => {
  test("loads every issue type assigned to a project", async () => {
    const issueTypes = await fetchProjectIssueTypes(auth, "HPCE", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/project/HPCE")
      return jsonResponse({ issueTypes: [{ id: "10009", name: "Story" }, { id: "10023", name: "Sub-task", subtask: true }] })
    })

    expect(issueTypes).toEqual([{ id: "10009", name: "Story" }, { id: "10023", name: "Sub-task", subtask: true }])
  })

  test("fetches one typed accessible-project page with Jira server-side query", async () => {
    const requests: string[] = []
    const page = await fetchAccessibleProjectPage(auth, { query: "health care", startAt: 50, maxResults: 50 }, async (url) => {
      requests.push(url)
      return jsonResponse({ startAt: 50, maxResults: 50, total: 1919, isLast: false, values: [{ id: "10000", key: "HPCE", name: "Health Care" }] })
    })

    expect(requests).toEqual(["https://team.atlassian.net/rest/api/3/project/search?startAt=50&maxResults=50&query=health%20care"])
    expect(page).toMatchObject({ startAt: 50, maxResults: 50, total: 1919, isLast: false, nextStartAt: 51 })
    expect(page.items).toEqual([{ id: "10000", key: "HPCE", name: "Health Care" }])
  })

  test("fetches project-scoped boards and treats simple boards as kanban", async () => {
    const boards = await fetchProjectBoards(auth, "PROJ", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/agile/1.0/board?projectKeyOrId=PROJ&startAt=0&maxResults=50")
      return jsonResponse({ values: [{ id: 42, name: "Product Scrum", type: "scrum" }, { id: 77, name: "Ops", type: "simple" }] })
    })

    expect(boards).toEqual([
      { id: "42", name: "Product Scrum", type: "scrum" },
      { id: "77", name: "Ops", type: "kanban" },
    ])
  })

  test("fetches board configuration", async () => {
    const config = await fetchBoardConfiguration(auth, "42", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/agile/1.0/board/42/configuration")
      return jsonResponse({ id: 42, name: "Product Scrum", columnConfig: { columns: [{ name: "To Do", statuses: [{ id: "10000" }] }] } })
    })

    expect(config.columnConfig?.columns?.[0]?.name).toBe("To Do")
  })

  test("fetches project workflow statuses", async () => {
    const statuses = await fetchProjectStatuses(auth, "PROJ", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/project/PROJ/statuses")
      return jsonResponse([{ name: "Task", statuses: [{ id: "10000", name: "Ready", statusCategory: { key: "new", name: "To Do" } }] }])
    })

    expect(statuses[0]?.statuses?.[0]?.name).toBe("Ready")
  })

  test("fetches individual status metadata by id", async () => {
    const statuses = await fetchStatusesByIds(auth, ["10483"], async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/2/status/10483")
      return jsonResponse({ id: "10483", name: "Fixed", statusCategory: { key: "indeterminate", name: "In Progress" } })
    })

    expect(statuses).toEqual([{ id: "10483", name: "Fixed", statusCategory: { key: "indeterminate", name: "In Progress" } }])
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
    }, ["customfield_10020", "customfield_10036"])

    expect(requests[0]?.startsWith("https://team.atlassian.net/rest/agile/1.0/sprint/7/issue?fields=")).toBe(true)
    expect(requests[0]).toContain("customfield_10020%2Ccustomfield_10036")
    expect(requests[0]).toContain("&startAt=0&maxResults=50")
    expect(issues).toEqual([{ key: "PROJ-1", fields: { summary: "Load active sprint" } }])
  })

  test("fetches Jira field metadata", async () => {
    const fields = await fetchJiraFields(auth, async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/field")
      return jsonResponse([{ id: "customfield_10020", name: "Sprint", schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" } }])
    })

    expect(fields).toEqual([{ id: "customfield_10020", name: "Sprint", schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" } }])
  })

  test("fetches a bounded board backlog issue page", async () => {
    const requests: string[] = []
    const issues = await fetchBoardBacklogIssues(auth, "42", async (url) => {
      requests.push(url)
      return jsonResponse({ startAt: 0, maxResults: 25, total: 85, issues: [{ key: "PROJ-9", fields: { summary: "Backlog issue" } }] })
    }, ["customfield_10020"], 25)

    expect(requests).toEqual(["https://team.atlassian.net/rest/agile/1.0/board/42/backlog?fields=summary%2Cissuetype%2Cpriority%2Cstatus%2Cassignee%2Creporter%2Cparent%2Clabels%2Ccomponents%2CfixVersions%2Cversions%2Cdescription%2Cissuelinks%2Csubtasks%2Ccreated%2Cupdated%2Cduedate%2Cresolution%2Ccustomfield_10020&startAt=0&maxResults=25"])
    expect(issues).toEqual([{ key: "PROJ-9", fields: { summary: "Backlog issue" } }])
  })

  test("fetches bounded issue pages with metadata", async () => {
    const backlogPage = await fetchBoardBacklogIssuePage(auth, "42", async (url) => {
      expect(url).toContain("/rest/agile/1.0/board/42/backlog?")
      expect(url).toContain("&startAt=25&maxResults=25")
      return jsonResponse({ startAt: 25, maxResults: 25, total: 75, issues: Array.from({ length: 25 }, (_, index) => ({ key: `PROJ-${index}` })) })
    }, [], 25, 25)
    const sprintPage = await fetchSprintIssuePage(auth, "7", async (url) => {
      expect(url).toContain("/rest/agile/1.0/sprint/7/issue?")
      expect(url).toContain("&startAt=0&maxResults=10")
      return jsonResponse({ startAt: 0, maxResults: 10, total: 3, issues: [{ key: "PROJ-1" }, { key: "PROJ-2" }, { key: "PROJ-3" }] })
    }, [], 0, 10)
    const boardPage = await fetchBoardIssuePage(auth, "42", async (url) => {
      expect(url).toContain("/rest/agile/1.0/board/42/issue?")
      expect(url).toContain("&startAt=0&maxResults=10")
      return jsonResponse({ startAt: 0, maxResults: 10, total: 1, issues: [{ key: "PROJ-4" }] })
    }, [], 0, 10)

    expect(backlogPage).toMatchObject({ startAt: 25, maxResults: 25, total: 75, isLast: false, nextStartAt: 50 })
    expect(backlogPage.items).toHaveLength(25)
    expect(sprintPage).toMatchObject({ total: 3, isLast: true, nextStartAt: 3 })
    expect(boardPage).toMatchObject({ total: 1, isLast: true, nextStartAt: 1 })
  })

  test("fetches bounded Jira search issue pages", async () => {
    const page = await fetchJiraSearchIssuePage(auth, "project = \"PROJ\" AND text ~ \"login\" ORDER BY updated DESC", async (url) => {
      expect(url).toContain("/rest/api/3/search/jql?")
      expect(url).toContain("jql=project%20%3D%20%22PROJ%22%20AND%20text%20~%20%22login%22%20ORDER%20BY%20updated%20DESC")
      expect(url).toContain("&maxResults=25&nextPageToken=cursor-1")
      return jsonResponse({ nextPageToken: "cursor-2", maxResults: 25, isLast: false, issues: [{ key: "PROJ-1" }] })
    }, [], 0, 25, "cursor-1")

    expect(page).toMatchObject({ cursor: "cursor-2", isLast: false, nextStartAt: 1 })
    expect(page.items).toEqual([{ key: "PROJ-1" }])
  })

  test("fetches issue detail with custom fields", async () => {
    const issue = await fetchIssueDetail(auth, "PROJ-1", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/issue/PROJ-1?fields=summary%2Cissuetype%2Cpriority%2Cstatus%2Cassignee%2Creporter%2Cparent%2Clabels%2Ccomponents%2CfixVersions%2Cversions%2Cdescription%2Cissuelinks%2Csubtasks%2Ccreated%2Cupdated%2Cduedate%2Cresolution%2Ccustomfield_10020")
      return jsonResponse({ key: "PROJ-1", fields: { summary: "Detailed issue" } })
    }, ["customfield_10020"])

    expect(issue.key).toBe("PROJ-1")
  })

  test("fetches paginated issue comments", async () => {
    const requests: string[] = []
    const comments = await fetchIssueComments(auth, "PROJ-1", async (url) => {
      requests.push(url)
      if (url.endsWith("startAt=0&maxResults=1")) return jsonResponse({ startAt: 0, total: 2, comments: [{ id: "1" }] })
      return jsonResponse({ startAt: 1, total: 2, comments: [{ id: "2" }] })
    }, 1)

    expect(requests).toEqual([
      "https://team.atlassian.net/rest/api/3/issue/PROJ-1/comment?startAt=0&maxResults=1",
      "https://team.atlassian.net/rest/api/3/issue/PROJ-1/comment?startAt=1&maxResults=1",
    ])
    expect(comments.map((comment) => comment.id)).toEqual(["1", "2"])
  })

  test("posts an ADF Jira issue comment", async () => {
    const comment = await postJiraIssueComment(auth, "PROJ-1", "Ready\nfor review", async (url, init) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/issue/PROJ-1/comment")
      expect(init?.method).toBe("POST")
      expect(new Headers(init?.headers).get("content-type")).toBe("application/json")
      expect(JSON.parse(String(init?.body))).toEqual({
        body: {
          type: "doc",
          version: 1,
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Ready" }, { type: "hardBreak" }, { type: "text", text: "for review" }] },
          ],
        },
      })
      return jsonResponse({ id: "10001" }, 201)
    })

    expect(comment.id).toBe("10001")
  })

  test("updates standard fields and ranks an issue", async () => {
    await updateJiraIssue(auth, "PROJ-1", { summary: "Updated summary", labels: ["frontend"] }, async (url, init) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/issue/PROJ-1")
      expect(init?.method).toBe("PUT")
      expect(JSON.parse(String(init?.body))).toEqual({ fields: { summary: "Updated summary", labels: ["frontend"] } })
      return new Response(null, { status: 204 })
    })
    await rankJiraIssue(auth, "PROJ-1", "PROJ-2", "after", async (url, init) => {
      expect(url).toBe("https://team.atlassian.net/rest/agile/1.0/issue/rank")
      expect(init?.method).toBe("PUT")
      expect(JSON.parse(String(init?.body))).toEqual({ issues: ["PROJ-1"], rankAfterIssue: "PROJ-2" })
      return new Response(null, { status: 204 })
    })
  })

  test("loads valid transitions and applies a selected transition ID", async () => {
    const transitions = await fetchJiraIssueTransitions(auth, "PROJ-1", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/issue/PROJ-1/transitions")
      return jsonResponse({ transitions: [{ id: "31", name: "Start progress", to: { id: "in-progress" } }] })
    })
    expect(transitions).toEqual([{ id: "31", name: "Start progress", to: { id: "in-progress" } }])

    await transitionJiraIssue(auth, "PROJ-1", "31", async (url, init) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/issue/PROJ-1/transitions")
      expect(init?.method).toBe("POST")
      expect(JSON.parse(String(init?.body))).toEqual({ transition: { id: "31" } })
      return new Response(null, { status: 204 })
    })
  })

  test("moves an issue to a sprint or the backlog", async () => {
    await moveJiraIssueToSprint(auth, "PROJ-1", "7", async (url, init) => {
      expect(url).toBe("https://team.atlassian.net/rest/agile/1.0/sprint/7/issue")
      expect(init?.method).toBe("POST")
      expect(JSON.parse(String(init?.body))).toEqual({ issues: ["PROJ-1"] })
      return new Response(null, { status: 204 })
    })
    await moveJiraIssueToSprint(auth, "PROJ-1", undefined, async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/agile/1.0/backlog/issue")
      return new Response(null, { status: 204 })
    })
  })

  test("loads issue-type edit metadata", async () => {
    const metadata = await fetchJiraIssueEditMetadata(auth, "PROJ-1", async (url) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/issue/PROJ-1/editmeta")
      return jsonResponse({ fields: { issuetype: { allowedValues: [{ id: "10001", name: "Bug" }] } } })
    })

    expect(metadata.fields?.issuetype?.allowedValues).toEqual([{ id: "10001", name: "Bug" }])
  })

  test("deletes an issue", async () => {
    await deleteJiraIssue(auth, "PROJ-1", async (url, init) => {
      expect(url).toBe("https://team.atlassian.net/rest/api/3/issue/PROJ-1")
      expect(init?.method).toBe("DELETE")
      return new Response(null, { status: 204 })
    })
  })

  test("normalizes board columns into app statuses with real workflow names", () => {
    const statusLookup = normalizeProjectStatuses([
      {
        name: "Task",
        statuses: [
          { id: "10000", name: "Ready", statusCategory: { key: "new", name: "To Do", colorName: "blue-gray" } },
          { id: "3", name: "Development", statusCategory: { key: "indeterminate", name: "In Progress", colorName: "yellow" } },
          { id: "10001", name: "Code Review", statusCategory: { key: "indeterminate", name: "In Progress", colorName: "yellow" } },
          { id: "10002", name: "Released", statusCategory: { key: "done", name: "Done", colorName: "green" } },
        ],
      },
    ])
    const metadata = normalizeBoardConfiguration({
      columnConfig: {
        columns: [
          { name: "To Do", statuses: [{ id: "10000" }] },
          { name: "In Progress", statuses: [{ id: "3" }, { id: "10001" }] },
          { name: "Done", statuses: [{ id: "10002" }] },
        ],
      },
    }, statusLookup)

    expect(metadata.columns.map((column) => column.name)).toEqual(["To Do", "In Progress", "Done"])
    expect(metadata.columns.map((column) => column.color)).toEqual(["#94A3B8", "#38BDF8", "#22C55E"])
    expect(metadata.columns[1]?.statusIds).toEqual(["3", "10001"])
    expect(metadata.statuses).toEqual([
      { id: "10000", name: "Ready", category: "todo", color: "#22D3EE" },
      { id: "3", name: "Development", category: "in-progress", color: "#38BDF8" },
      { id: "10001", name: "Code Review", category: "in-progress", color: "#A78BFA" },
      { id: "10002", name: "Released", category: "done", color: "#22C55E" },
    ])
  })

  test("normalizes board sprints", () => {
    const sprints = normalizeBoardSprints([
      { id: 7, state: "active", name: "Sprint 7", goal: "Finish read path", startDate: "2026-07-27T00:00:00.000Z", endDate: "2026-08-07T00:00:00.000Z" },
      { id: "8", state: "future", name: "Sprint 8" },
      { id: 9, state: "unknown", name: "Ignored" },
    ])

    expect(sprints).toEqual([
      { id: "7", name: "Sprint 7", goal: "Finish read path", state: "active", startDate: "2026-07-27T00:00:00.000Z", endDate: "2026-08-07T00:00:00.000Z" },
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

  test("discovers and normalizes Jira sprint, points, estimate, and rank fields", () => {
    const fieldIds = discoverJiraIssueFieldIds([
      { id: "customfield_10020", name: "Sprint", schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" } },
      { id: "customfield_10036", name: "Story Points" },
      { id: "customfield_10016", name: "Story point estimate" },
      { id: "customfield_10019", name: "Rank" },
    ])
    const issues = normalizeSprintIssues([
      {
        key: "PROJ-2",
        fields: {
          summary: "Plan backlog issue",
          status: { id: "10000", name: "To Do" },
          customfield_10020: [{ id: 6, state: "closed", name: "Old Sprint" }, { id: 8, state: "future", name: "Next Sprint" }],
          customfield_10036: 5,
          customfield_10016: 13,
          customfield_10019: "1|hyfa07:",
        },
      },
    ], "7", [{ id: "10000", name: "To Do", category: "todo", color: "#94A3B8" }], fieldIds)

    expect(fieldIds).toEqual({ sprint: "customfield_10020", storyPoints: "customfield_10036", storyPointEstimate: "customfield_10016", rank: "customfield_10019" })
    expect(issues[0]).toMatchObject({
      sprintId: "8",
      storyPoints: 5,
      estimate: 13,
      rank: "1|hyfa07:",
    })
  })

  test("discovers Jira issue colors and keeps Jira Feature colors distinct", () => {
    const fieldIds = discoverJiraIssueFieldIds([
      { id: "customfield_10017", name: "Issue color" },
      { id: "customfield_10013", name: "Epic Color" },
    ])
    const issues = normalizeJiraIssues([
      { key: "HPCE-1296", fields: { summary: "Perfect Forecast", status: { id: "todo" }, customfield_10017: "green", customfield_10013: "ghx-label-6" } },
      { key: "HPCE-1488", fields: { summary: "List of enhancement", status: { id: "todo" }, customfield_10017: "teal", customfield_10013: "ghx-label-11" } },
    ], [{ id: "todo", name: "To Do", category: "todo", color: "#6B778C" }], { fieldIds })

    expect(fieldIds).toEqual({ issueColor: "customfield_10017", epicColor: "customfield_10013" })
    expect(issues.map((issue) => [issue.key, issue.issueColor])).toEqual([
      ["HPCE-1296", "#36B37E"],
      ["HPCE-1488", "#00B8D9"],
    ])
  })

  test("discovers Start date by system schema precedence and rejects ambiguous named date fields", () => {
    const fields = [
      { id: "customfield_1", name: "Start date", schema: { type: "date" } },
      { id: "startdate", name: "Target start", schema: { type: "date", system: "startdate" } },
    ]
    expect(discoverJiraStartDateField(fields)).toEqual({ status: "available", fieldId: "startdate" })
    expect(discoverJiraIssueFieldIds(fields).startDate).toBe("startdate")
    expect(discoverJiraStartDateField([
      { id: "customfield_1", name: "Start Date", schema: { type: "date" } },
      { id: "customfield_2", name: " start   date ", schema: { type: "date" } },
    ])).toEqual({ status: "unavailable", reason: "ambiguous", candidateIds: ["customfield_1", "customfield_2"] })
    expect(discoverJiraStartDateField([{ id: "customfield_3", name: "Start date", schema: { type: "string" } }])).toEqual({ status: "unavailable", reason: "not-found" })
  })

  test("normalizes Start date, Due date, and complete parent metadata", () => {
    const issue = normalizeJiraIssues([{
      key: "PROJ-9",
      fields: {
        summary: "Scheduled child",
        issuetype: { id: "10009", name: "Story", hierarchyLevel: 0 },
        status: { id: "todo" },
        assignee: { accountId: "account-1", displayName: "Duy Trinh" },
        parent: { key: "PROJ-1", fields: { summary: "Parent initiative", issuetype: { id: "10000", name: "Initiative", hierarchyLevel: 1 } } },
        duedate: "2026-09-30",
        customfield_12345: "2026-08-01",
      },
    }], [{ id: "todo", name: "To Do", category: "todo", color: "#fff" }], { fieldIds: { startDate: "customfield_12345" } })[0]!

    expect(issue).toMatchObject({
      startDate: "2026-08-01",
      dueDate: "2026-09-30",
      type: "10009",
      typeName: "Story",
      typeHierarchyLevel: 0,
      assigneeAccountId: "account-1",
      parentKey: "PROJ-1",
      parent: { key: "PROJ-1", title: "Parent initiative", type: "10000", typeName: "Initiative", typeHierarchyLevel: 1 },
    })
  })

  test("normalizes backlog issues without assigning a fallback sprint", () => {
    const issues = normalizeJiraIssues([
      { key: "PROJ-3", fields: { summary: "True backlog issue", status: { id: "10000", name: "To Do" }, customfield_10020: [{ id: 4, state: "closed", name: "Old Sprint" }], customfield_10016: 3 } },
    ], [{ id: "10000", name: "To Do", category: "todo", color: "#94A3B8" }], { fieldIds: { sprint: "customfield_10020", storyPointEstimate: "customfield_10016" } })

    expect(issues[0]).toMatchObject({ key: "PROJ-3", sprintId: undefined, storyPoints: 3, estimate: 3 })
  })

  test("normalizes Jira comments and merges detail over an existing issue", () => {
    const existing = normalizeJiraIssues([
      { key: "PROJ-4", fields: { summary: "Summary", status: { id: "10000" } } },
    ], [{ id: "10000", name: "To Do", category: "todo", color: "#94A3B8" }])[0]!
    const detail = normalizeJiraIssues([
      { key: "PROJ-4", fields: { summary: "Detailed summary", status: { id: "10000" }, description: { content: [{ content: [{ text: "Detailed body" }] }] } } },
    ], [{ id: "10000", name: "To Do", category: "todo", color: "#94A3B8" }])[0]!
    const comments = normalizeJiraComments([
      { id: "10001", author: { displayName: "Mina" }, body: { content: [{ content: [{ text: "Looks good" }] }] }, updated: "2026-07-24T10:00:00.000+0000" },
    ])

    expect(comments).toEqual([{ id: "10001", author: "Mina", body: "Looks good", age: "2026-07-24" }])
    expect(mergeIssueDetail(existing, detail, comments)).toMatchObject({ title: "Detailed summary", description: "Detailed body", comments })
  })

  test("keeps unsupported Jira ADF readable and marks it write-blocked", () => {
    const issue = normalizeJiraIssues([
      { key: "PROJ-5", fields: { summary: "Rich body", status: { id: "10000" }, description: { type: "doc", content: [{ type: "mediaSingle", content: [] }] } } },
    ], [{ id: "10000", name: "To Do", category: "todo", color: "#94A3B8" }])[0]!

    expect(issue.description).toContain("Unsupported Jira content: mediaSingle")
    expect(issue.descriptionWriteBlockedReason).toContain("mediaSingle")
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
    const error = await expectJiraError(() => fetchAccessibleProjectPage(auth, {}, async () => jsonResponse({ errorMessages: ["No access"] }, 403)))

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
