import { describe, expect, test } from "bun:test"
import { detailBodyInitialValue } from "../context/app-state"
import { applyIssueDraft, issueFieldColor, issueFieldDisplayValue, issueFields } from "./issue-fields"
import { loadDevWorkspaceState } from "./dev"

describe("issue fields", () => {
  test("keeps body editing out of the inspector field list", () => {
    expect(issueFields.some((field) => field.id === "description")).toBe(false)
  })

  test("applies staged field changes to an issue", () => {
    const state = loadDevWorkspaceState()
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
    const state = loadDevWorkspaceState()
    const issue = state.issues[state.selectedIssueKey]!
    const statusField = issueFields.find((field) => field.id === "statusId")!
    state.issueDrafts[issue.key] = { statusId: "code-review" }

    expect(issueFieldDisplayValue(state, issue, statusField)).toBe("Code Review")
    expect(issueFieldColor(state, issue, statusField)).toBe("#A78BFA")
  })

  test("opens body editor with existing issue body", () => {
    const state = loadDevWorkspaceState()
    const issue = state.issues[state.selectedIssueKey]!

    expect(detailBodyInitialValue(state, issue)).toBe(issue.description)
    expect(detailBodyInitialValue(state, issue).length).toBeGreaterThan(0)
  })
})
