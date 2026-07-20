import { describe, expect, test } from "bun:test"
import { loadDemoWorkspace } from "./demo"

describe("demo workspace", () => {
  test("loads without Jira credentials", () => {
    const state = loadDemoWorkspace()

    expect(state.demoMode).toBe(true)
    expect(state.route).toBe("workspace")
    expect(state.columns.length).toBeGreaterThan(0)
    expect(state.issues[state.selectedIssueKey]?.key).toBe(state.selectedIssueKey)
  })
})
