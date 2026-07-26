import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { planJiraWrites, writePlanCounts } from "./jira-write-plan"

describe("Jira write plan", () => {
  test("plans safe Jira field updates from staged edits", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = {
      title: "Updated summary",
      priority: "Critical",
      labels: "auth, release",
      description: "Updated\ndescription",
    }

    const plan = planJiraWrites(state)

    expect(writePlanCounts(plan)).toEqual({ planned: 4, blocked: 0 })
    expect(plan.map((item) => item.payloadPreview)).toEqual([
      "fields.summary = Updated summary",
      "fields.priority.name = Critical",
      "fields.labels = [auth, release]",
      "fields.description = Updated\ndescription",
    ])
    expect(plan.every((item) => item.method === "PUT" && item.endpoint === "/rest/api/3/issue/PROJ-128")).toBe(true)
  })

  test("plans status transitions and blocks changes that need unresolved metadata or stronger confirmation", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = {
      statusId: "done",
      assignee: "Mina",
      sprintId: "sprint-25",
      storyPoints: "8",
    }
    state.issueDeletes = ["PROJ-121"]
    state.configDrafts = [{ id: "config-1", sectionId: "statuses", action: "rename", targetId: "todo", name: "Ready" }]

    const plan = planJiraWrites(state)

    expect(writePlanCounts(plan)).toEqual({ planned: 1, blocked: 5 })
    expect(plan[0]).toMatchObject({ operation: "transition", transitionStatusId: "done", endpoint: "/rest/api/3/issue/PROJ-128/transitions" })
    expect(plan.map((item) => item.blocker)).toEqual([
      undefined,
      "Select a Jira project member from the user picker.",
      "Sprint moves need exact target confirmation and Agile move endpoint wiring.",
      "This field needs Jira custom field mapping before it can be written safely.",
      "Remote delete is not approved yet.",
      "Board/status/type config writes are local-only until Jira admin metadata writes are scoped.",
    ])
  })

  test("folds staged edits on draft issues into the blocked create preview", () => {
    const state = loadDevWorkspaceState()
    state.issues["DRAFT-1"] = { ...state.issues["PROJ-121"]!, key: "DRAFT-1", title: "New issue", isDraft: true }
    state.issueDrafts["DRAFT-1"] = { title: "Remote create candidate" }

    const plan = planJiraWrites(state)

    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({
      id: "create:DRAFT-1",
      status: "blocked",
      method: "POST",
      endpoint: "/rest/api/3/issue",
      detail: "Task · Remote create candidate",
      blocker: "Create metadata and Jira issue type IDs are not loaded yet.",
    })
  })

  test("plans staged comments and exact backlog rank operations", () => {
    const state = loadDevWorkspaceState()
    state.commentDrafts = [{ id: "comment-1", issueKey: "PROJ-128", body: "Ready for review" }]
    state.rankDrafts = { "PROJ-128": { issueKey: "PROJ-128", targetIssueKey: "PROJ-121", position: "after" } }

    const plan = planJiraWrites(state)

    expect(writePlanCounts(plan)).toEqual({ planned: 2, blocked: 0 })
    expect(plan).toEqual([
      expect.objectContaining({
        id: "comment:comment-1",
        method: "POST",
        endpoint: "/rest/api/3/issue/PROJ-128/comment",
        payloadPreview: "body = Ready for review",
      }),
      expect.objectContaining({
        id: "rank:PROJ-128",
        method: "PUT",
        endpoint: "/rest/agile/1.0/issue/rank",
        payloadPreview: "issues = [PROJ-128], rankAfterIssue = PROJ-121",
      }),
    ])
  })
})
