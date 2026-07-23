import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"

describe("dev workspace state", () => {
  test("loads fixture data without Jira credentials", () => {
    const state = loadDevWorkspaceState()

    expect(state.runtimeEnv).toBe("dev")
    expect(state.route).toBe("active-sprint")
    expect(state.statuses.length).toBeGreaterThan(4)
    expect(state.issueTypes.map((type) => type.id)).toContain("Subtask")
    expect(Object.keys(state.issues).length).toBeGreaterThan(9)
    expect(state.issues[state.selectedIssueKey]?.key).toBe(state.selectedIssueKey)
  })
})
