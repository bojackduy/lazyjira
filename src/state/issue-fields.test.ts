import { describe, expect, test } from "bun:test"
import { applyIssueDraft } from "./issue-fields"
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
})
