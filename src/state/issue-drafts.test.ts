import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { issueWithDraft } from "./issue-drafts"

describe("issue draft render overlay", () => {
  test("renders staged fields without mutating the base issue", () => {
    const state = loadDevWorkspaceState()
    const baseIssue = state.issues["PROJ-128"]!
    state.issueDrafts[baseIssue.key] = { title: "Rendered staged title", statusId: "code-review", storyPoints: "8" }

    const renderedIssue = issueWithDraft(state, baseIssue)

    expect(renderedIssue.title).toBe("Rendered staged title")
    expect(renderedIssue.statusId).toBe("code-review")
    expect(renderedIssue.storyPoints).toBe(8)
    expect(baseIssue.title).toBe("Fix login redirect after expired session")
    expect(baseIssue.statusId).toBe("blocked")
    expect(baseIssue.storyPoints).toBe(5)
  })

  test("falls back to the base issue after staged draft removal", () => {
    const state = loadDevWorkspaceState()
    const baseIssue = state.issues["PROJ-128"]!
    state.issueDrafts[baseIssue.key] = { title: "Rendered staged title" }

    expect(issueWithDraft(state, baseIssue).title).toBe("Rendered staged title")

    delete state.issueDrafts[baseIssue.key]

    expect(issueWithDraft(state, baseIssue).title).toBe(baseIssue.title)
  })

  test("renders an exact Jira Priority draft without retaining the old Priority color", () => {
    const state = loadDevWorkspaceState()
    const baseIssue = state.issues["PROJ-128"]!
    baseIssue.priorityColor = "#FF5630"
    state.issueDrafts[baseIssue.key] = { priority: "Highest" }

    expect(issueWithDraft(state, baseIssue)).toMatchObject({ priority: "Highest", priorityColor: undefined })
    expect(baseIssue).toMatchObject({ priority: "High", priorityColor: "#FF5630" })
  })
})
