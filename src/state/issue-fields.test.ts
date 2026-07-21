import { describe, expect, test } from "bun:test"
import { applyIssueDraft, issueFieldColor, issueFieldDisplayValue, issueFields } from "./issue-fields"
import { loadDemoWorkspace } from "./demo"

describe("issue fields", () => {
  test("applies staged field changes to an issue", () => {
    const state = loadDemoWorkspace()
    const issue = state.issues[state.selectedIssueKey]!

    const next = applyIssueDraft(issue, {
      title: "Updated summary",
      labels: "auth, urgent",
      storyPoints: "8",
      blocked: "no",
    }, state)

    expect(next.title).toBe("Updated summary")
    expect(next.labels).toEqual(["auth", "urgent"])
    expect(next.storyPoints).toBe(8)
    expect(next.blocked).toBe(false)
  })

  test("formats staged status choices with board labels and colors", () => {
    const state = loadDemoWorkspace()
    const issue = state.issues[state.selectedIssueKey]!
    const statusField = issueFields.find((field) => field.id === "statusId")!
    state.issueDrafts[issue.key] = { statusId: "code-review" }

    expect(issueFieldDisplayValue(state, issue, statusField)).toBe("Code Review")
    expect(issueFieldColor(state, issue, statusField)).toBe("#A78BFA")
  })
})
