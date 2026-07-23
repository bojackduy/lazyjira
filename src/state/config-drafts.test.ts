import { describe, expect, test } from "bun:test"
import { configuredIssueTypes, configuredStatuses } from "./config-drafts"
import { loadDevWorkspaceState } from "./dev"
import { stagedChanges } from "./staged-changes"
import { workspacePendingItem } from "./workspace"

describe("config draft overlay", () => {
  test("renders staged status changes without mutating base metadata", () => {
    const state = loadDevWorkspaceState()
    state.configDrafts = [
      { id: "config-1", sectionId: "statuses", action: "rename", targetId: "blocked", name: "Waiting" },
      { id: "config-2", sectionId: "statuses", action: "color", targetId: "blocked", color: "#111111" },
      { id: "config-3", sectionId: "statuses", action: "add", name: "Ready", color: "#00AA00", category: "review" },
      { id: "config-4", sectionId: "statuses", action: "remove", targetId: "qa" },
    ]

    const statuses = configuredStatuses(state)

    expect(statuses.find((status) => status.id === "blocked")?.name).toBe("Waiting")
    expect(statuses.find((status) => status.id === "blocked")?.color).toBe("#111111")
    expect(statuses.find((status) => status.id === "ready")?.category).toBe("review")
    expect(statuses.some((status) => status.id === "qa")).toBe(false)
    expect(state.statuses.find((status) => status.id === "blocked")?.name).toBe("Blocked")
    expect(state.statuses.some((status) => status.id === "qa")).toBe(true)
  })

  test("renders staged issue type changes without mutating base metadata", () => {
    const state = loadDevWorkspaceState()
    state.configDrafts = [
      { id: "config-1", sectionId: "issue-types", action: "rename", targetId: "Bug", name: "Defect" },
      { id: "config-2", sectionId: "issue-types", action: "color", targetId: "Bug", color: "#111111" },
      { id: "config-3", sectionId: "issue-types", action: "add", name: "Spike", color: "#00AA00" },
      { id: "config-4", sectionId: "issue-types", action: "remove", targetId: "Subtask" },
    ]

    const issueTypes = configuredIssueTypes(state)

    expect(issueTypes.find((issueType) => issueType.id === "Bug")?.name).toBe("Defect")
    expect(issueTypes.find((issueType) => issueType.id === "Bug")?.color).toBe("#111111")
    expect(issueTypes.find((issueType) => issueType.id === "Spike")?.name).toBe("Spike")
    expect(issueTypes.some((issueType) => issueType.id === "Subtask")).toBe(false)
    expect(state.issueTypes.find((issueType) => issueType.id === "Bug")?.name).toBe("Bug")
    expect(state.issueTypes.some((issueType) => issueType.id === "Subtask")).toBe(true)
  })

  test("includes config drafts in the shared staged queue", () => {
    const state = loadDevWorkspaceState()
    state.configDrafts = [{ id: "config-1", sectionId: "columns", action: "rename", targetId: "todo", name: "Ready" }]

    const changes = stagedChanges(state)

    expect(changes).toEqual([{ id: "config:config-1", kind: "config", draftId: "config-1", label: "Config", value: "~ Column todo -> Ready" }])
    expect(workspacePendingItem(state).subtitle).toBe("0 edits · 0 deletes · 1 config · X discard · W write Jira")
  })
})
