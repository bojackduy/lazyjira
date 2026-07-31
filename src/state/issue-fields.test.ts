import { describe, expect, test } from "bun:test"
import { detailBodyInitialValue } from "../context/app-state"
import { applyIssueDraft, issueFieldColor, issueFieldDisplayValue, issueFields, parentIssueChoices } from "./issue-fields"
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

  test("displays loaded and staged type IDs as issue type names", () => {
    const state = loadDevWorkspaceState()
    const issue = { ...state.issues[state.selectedIssueKey]!, type: "10001", typeName: "Story" }
    const typeField = issueFields.find((field) => field.id === "type")!
    state.issueTypes = [
      { id: "10001", name: "Story", color: "#3B82F6" },
      { id: "10002", name: "Bug", color: "#EF4444" },
    ]

    expect(issueFieldDisplayValue(state, issue, typeField)).toBe("Story")

    state.issueDrafts[issue.key] = { type: "10002" }

    expect(issueFieldDisplayValue(state, issue, typeField)).toBe("Bug")
  })

  test("colors the parent field and picker choices by parent key", () => {
    const state = loadDevWorkspaceState()
    state.issueTypes = [
      { id: "Feature", name: "Feature", color: "#22C55E", hierarchyLevel: 1 },
      { id: "Story", name: "Story", color: "#3B82F6", hierarchyLevel: 0 },
    ]
    const issue = { ...state.issues[state.selectedIssueKey]!, type: "Story", parentKey: "PARENT-1", parent: { key: "PARENT-1", title: "Parent feature", type: "Feature" } }
    const parentField = issueFields.find((field) => field.id === "parentKey")!
    state.issues["PARENT-1"] = { ...issue, key: "PARENT-1", type: "Feature", issueColor: "#00B8D9", parentKey: undefined, parent: undefined }

    expect(issueFieldColor(state, issue, parentField)).toBe("#00B8D9")
    expect(parentIssueChoices(state, issue).find((choice) => choice.value === "PARENT-1")?.color).toBe("#00B8D9")
  })

  test("opens body editor with existing issue body", () => {
    const state = loadDevWorkspaceState()
    const issue = state.issues[state.selectedIssueKey]!

    expect(detailBodyInitialValue(state, issue)).toBe(issue.description)
    expect(detailBodyInitialValue(state, issue).length).toBeGreaterThan(0)
  })

  test("only offers loaded higher-level issues as parent choices when Jira exposes hierarchy levels", () => {
    const state = loadDevWorkspaceState()
    state.issueTypes = [
      { id: "Feature", name: "Feature", color: "#22C55E", hierarchyLevel: 1 },
      { id: "Story", name: "Story", color: "#3B82F6", hierarchyLevel: 0 },
      { id: "Subtask", name: "Subtask", color: "#64748B", hierarchyLevel: -1, subtask: true },
    ]
    const issue = { ...state.issues[state.selectedIssueKey]!, type: "Story" }
    state.issues["PARENT-1"] = { ...issue, key: "PARENT-1", title: "Parent feature", type: "Feature" }
    state.issues["CHILD-1"] = { ...issue, key: "CHILD-1", title: "Nested child", type: "Subtask" }

    expect(parentIssueChoices(state, issue).map((choice) => choice.value)).toContain("PARENT-1")
    expect(parentIssueChoices(state, issue).map((choice) => choice.value)).not.toContain("CHILD-1")
  })
})
