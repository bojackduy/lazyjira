import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { issueList } from "./selectors"
import { parseIssueSearchQuery } from "./issue-search"

describe("issue search", () => {
  test("parses text, field, quoted, and negated tokens", () => {
    expect(parseIssueSearchQuery('auth assignee:duy status:"Code Review" -type:bug')).toEqual([
      { kind: "text", value: "auth", negated: false },
      { kind: "field", field: "assignee", value: "duy", negated: false },
      { kind: "field", field: "status", value: "Code Review", negated: false },
      { kind: "field", field: "type", value: "bug", negated: true },
    ])
  })

  test("filters loaded issues by text and fields", () => {
    const state = loadDevWorkspaceState()
    state.searchQuery = "auth assignee:duy priority:high"

    expect(issueList(state).map((issue) => issue.key)).toContain("PROJ-128")
    expect(issueList(state).every((issue) => issue.assignee === "Duy" && issue.priority === "High")).toBe(true)
  })

  test("keeps the loaded filter unchanged while typing until Enter commits", () => {
    const state = loadDevWorkspaceState()
    state.searchQuery = "auth"
    state.searchOpen = true
    state.searchMode = "loaded"
    const committedKeys = issueList(state).map((issue) => issue.key)

    state.searchDraft = "no-match-while-typing"

    expect(issueList(state).map((issue) => issue.key)).toEqual(committedKeys)
  })

  test("uses staged issue draft values while filtering", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { statusId: "code-review" }
    state.searchQuery = "status:code-review"

    expect(issueList(state).map((issue) => issue.key)).toContain("PROJ-128")
    expect(state.issues["PROJ-128"]?.statusId).toBe("blocked")
  })

  test("uses staged config metadata names while filtering", () => {
    const state = loadDevWorkspaceState()
    state.configDrafts = [{ id: "config-1", sectionId: "statuses", action: "rename", targetId: "blocked", name: "Waiting" }]
    state.searchQuery = "status:waiting"

    expect(issueList(state).map((issue) => issue.key)).toContain("PROJ-128")
  })

  test("searches loaded issue types by metadata name and normalized fallback name", () => {
    const state = loadDevWorkspaceState()
    state.issues["PROJ-128"] = { ...state.issues["PROJ-128"]!, type: "10001", typeName: "Story" }
    state.issueTypes = [{ id: "10001", name: "Story", color: "#3B82F6" }]
    state.searchQuery = "type:story"

    expect(issueList(state).map((issue) => issue.key)).toContain("PROJ-128")

    state.issueTypes = []

    expect(issueList(state).map((issue) => issue.key)).toContain("PROJ-128")
  })

  test("supports special loaded-data tokens", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { title: "Rendered staged title" }
    state.searchQuery = "has:staged"

    expect(issueList(state).map((issue) => issue.key)).toEqual(["PROJ-128"])

    state.searchQuery = "no:sprint"
    expect(issueList(state).map((issue) => issue.key)).toContain("PROJ-211")
  })
})
