import { describe, expect, test } from "bun:test"
import { loadDemoWorkspace } from "./demo"

describe("demo workspace", () => {
  test("loads without Jira credentials", () => {
    const state = loadDemoWorkspace()

    expect(state.demoMode).toBe(true)
    expect(state.route).toBe("active-sprint")
    expect(state.statuses.length).toBeGreaterThan(4)
    expect(state.issueTypes.map((type) => type.id)).toContain("Subtask")
    expect(Object.keys(state.issues).length).toBeGreaterThan(10)
    expect(state.issues[state.selectedIssueKey]?.key).toBe(state.selectedIssueKey)
  })
})
