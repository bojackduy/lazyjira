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

  test("blocks a description replacement when loaded ADF was unsupported", () => {
    const state = loadDevWorkspaceState()
    state.issues["PROJ-128"]!.descriptionWriteBlockedReason = "This Jira text contains unsupported ADF content (mediaSingle) and cannot be safely replaced yet."
    state.issueDrafts["PROJ-128"] = { description: "# Replacement" }

    expect(planJiraWrites(state)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "edit:PROJ-128:description",
        status: "blocked",
        blocker: "This Jira text contains unsupported ADF content (mediaSingle) and cannot be safely replaced yet.",
      }),
    ]))
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

    expect(writePlanCounts(plan)).toEqual({ planned: 4, blocked: 2 })
    expect(plan[0]).toMatchObject({ operation: "transition", transitionStatusId: "done", endpoint: "/rest/api/3/issue/PROJ-128/transitions" })
    expect(plan[2]).toMatchObject({ operation: "sprint-move", sprintId: "sprint-25" })
    expect(plan[3]).toMatchObject({ operation: "discovered-field", discoveredField: "storyPoints", fieldValue: "8" })
    expect(plan.map((item) => item.blocker)).toEqual([
      undefined,
      "Select a Jira project member from the user picker.",
      undefined,
      undefined,
      undefined,
      "Board/status/type config writes are local-only until Jira admin metadata writes are scoped.",
    ])
  })

  test("folds staged edits on draft issues into a create operation", () => {
    const state = loadDevWorkspaceState()
    state.issues["DRAFT-1"] = { ...state.issues["PROJ-121"]!, key: "DRAFT-1", title: "New issue", isDraft: true }
    state.issueDrafts["DRAFT-1"] = { title: "Remote create candidate" }

    const plan = planJiraWrites(state)

    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({
      id: "create:DRAFT-1",
      status: "planned",
      operation: "create",
      method: "POST",
      endpoint: "/rest/api/3/issue",
      detail: "Task · Remote create candidate",
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
