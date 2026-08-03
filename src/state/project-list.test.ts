import { describe, expect, test } from "bun:test"
import { createInitialAppState } from "./initial"
import { projectListIssuePageSourceId } from "./issue-pages"
import { projectListColumns, projectListLoadMoreRowKey, projectListRows, projectListSelection, projectListSelectionKeys, projectListStateText, projectListViewportWidth } from "./project-list"
import { loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import type { IssuePageState } from "./app-state"

describe("project list state", () => {
  test("degrades columns in the documented order and always keeps identity", () => {
    expect(ids(150)).toEqual(["key", "summary", "type", "status", "assignee", "priority", "due", "parent", "sprint", "updated"])
    expect(ids(135)).not.toContain("updated")
    expect(ids(120)).not.toContain("sprint")
    expect(ids(105)).not.toContain("parent")
    expect(ids(90)).not.toContain("due")
    expect(ids(40)).toEqual(["key", "summary"])
    expect(projectListColumns(135, 1).map((column) => column.id)).toContain("updated")
    expect(projectListViewportWidth(150)).toBe(80)
    expect(projectListColumns(projectListViewportWidth(150)).map((column) => column.id)).toEqual(["key", "summary", "type", "status"])
    expect(projectListViewportWidth(80)).toBe(76)
  })

  test("keeps row navigation within loaded bounds", () => {
    const keys = ["PROJ-1", "PROJ-2", "PROJ-3"]
    expect(projectListSelection(keys, "PROJ-1", -1)).toBe("PROJ-1")
    expect(projectListSelection(keys, "PROJ-3", 1)).toBe("PROJ-3")
    expect(projectListSelection(keys, "PROJ-2", "first")).toBe("PROJ-1")
    expect(projectListSelection(keys, "PROJ-2", "last")).toBe("PROJ-3")
    expect(projectListSelection([], undefined, 1)).toBeUndefined()
    expect(projectListSelection(keys, "PROJ-1", 2)).toBe("PROJ-3")
    expect(projectListSelection(keys, "PROJ-3", -2)).toBe("PROJ-1")
    expect(projectListSelection(keys, "PROJ-2", 20)).toBe("PROJ-3")
  })

  test("places a partial-page action after visible issues", () => {
    const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    state.issueKeysBySource[projectListIssuePageSourceId] = ["PROJ-121"]
    state.issuePageStateBySource[projectListIssuePageSourceId] = page({ startAt: 1, total: 5 })

    expect(projectListSelectionKeys(state).at(-1)).toBe(projectListLoadMoreRowKey)
    state.issuePageStateBySource[projectListIssuePageSourceId]!.isLast = true
    expect(projectListSelectionKeys(state)).not.toContain(projectListLoadMoreRowKey)
  })

  test("orders List rows by parent hierarchy and exposes indentation depth", () => {
    const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    state.issueKeysBySource[projectListIssuePageSourceId] = ["PROJ-303", "PROJ-302", "PROJ-301", "PROJ-300"]
    state.issuePageStateBySource[projectListIssuePageSourceId] = page({ startAt: 4, total: 4, isLast: true })

    expect(projectListRows(state).map((row) => [row.issue.key, row.depth])).toEqual([
      ["PROJ-300", 0],
      ["PROJ-301", 1],
      ["PROJ-302", 2],
      ["PROJ-303", 3],
    ])

    state.collapsedProjectListParentKeys = ["PROJ-300"]
    expect(projectListRows(state).map((row) => row.issue.key)).toEqual(["PROJ-300"])
  })

  test("distinguishes loading, partial, filtered empty, append failure, permission, and empty copy", () => {
    const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    expect(projectListStateText(state)).toContain("Loading PROJ project issues")

    state.issueKeysBySource[projectListIssuePageSourceId] = ["PROJ-121"]
    state.issuePageStateBySource[projectListIssuePageSourceId] = page({ startAt: 1, total: 5 })
    expect(projectListStateText(state)).toBe("1/5 project issues loaded · L load more")
    state.issuePageStateBySource[projectListIssuePageSourceId]!.loading = true
    expect(projectListStateText(state)).toBe("Loading more project issues · 1/5 retained...")
    state.issuePageStateBySource[projectListIssuePageSourceId]!.loading = false

    state.searchQuery = "no-match"
    expect(projectListStateText(state)).toContain("No loaded project issues match")
    state.searchQuery = ""
    state.issuePageStateBySource[projectListIssuePageSourceId] = page({ startAt: 1, total: 5, error: "Jira 429: Retry later" })
    expect(projectListStateText(state)).toContain("1 rows retained · L retry")

    state.issueKeysBySource[projectListIssuePageSourceId] = []
    state.issuePageStateBySource[projectListIssuePageSourceId] = page({ error: "Jira 403: No access" })
    expect(projectListStateText(state)).toContain("requires Browse Projects and issue access")
    state.issuePageStateBySource[projectListIssuePageSourceId] = page({ isLast: true, total: 0 })
    expect(projectListStateText(state)).toBe("Jira returned no issues for project PROJ.")
  })
})

function ids(width: number) {
  return projectListColumns(width).map((column) => column.id)
}

function page(overrides: Partial<IssuePageState>) {
  return { ...pageBase(), ...overrides }
}

function pageBase(): IssuePageState {
  return { sourceId: projectListIssuePageSourceId, startAt: 0, maxResults: 50, isLast: false, loading: false }
}
