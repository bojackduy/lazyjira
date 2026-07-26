import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { activeSprintIssues, boardStatusWindowSize, groupBacklogIssues, visibleStatusesForBoard } from "./selectors"

describe("board selectors", () => {
  test("shows all statuses when the board is wide enough", () => {
    const state = loadDevWorkspaceState()

    expect(boardStatusWindowSize(220, state.statuses.length)).toBe(state.statuses.length)
    expect(visibleStatusesForBoard(state, "active-sprint", 220).map((status) => status.name)).toEqual([
      "To Do",
      "In Progress",
      "Code Review",
      "QA",
      "Blocked",
      "Done",
    ])
  })

  test("keeps a smaller status window on constrained boards", () => {
    const state = loadDevWorkspaceState()
    const windowSize = boardStatusWindowSize(130, state.statuses.length)

    expect(windowSize).toBeGreaterThan(0)
    expect(windowSize).toBeLessThan(state.statuses.length)
  })

  test("uses staged render overlay for issue status without changing base issue", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { statusId: "code-review" }

    const renderedIssue = activeSprintIssues(state).find((issue) => issue.key === "PROJ-128")

    expect(renderedIssue?.statusId).toBe("code-review")
    expect(state.issues["PROJ-128"]?.statusId).toBe("blocked")
  })

  test("keeps empty sprint and backlog groups visible for backlog navigation", () => {
    const state = loadDevWorkspaceState()
    state.issues = {}

    expect(groupBacklogIssues(state, "sprint").map((group) => group.id)).toEqual([...state.sprints.map((sprint) => sprint.id), "backlog"])
  })
})
