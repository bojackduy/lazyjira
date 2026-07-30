import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { activeSprint, activeSprintIssues, backlogCreateSprintId, boardStatusWindowSize, emptyLoadedIssuesText, groupBacklogIssues, kanbanIssues, sprintDateRange, visibleStatusesForBoard } from "./selectors"

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
    state.board = { ...state.board, type: "scrum" }
    state.issues = {}

    expect(groupBacklogIssues(state, "sprint").map((group) => group.id)).toEqual([...state.sprints.map((sprint) => sprint.id), "backlog"])
  })

  test("uses one non-sprint planning group for Kanban regardless of grouping state", () => {
    const state = loadDevWorkspaceState()

    const groups = groupBacklogIssues(state, "sprint")

    expect(groups).toHaveLength(1)
    expect(groups[0]?.id).toBe("backlog")
    expect(groups[0]?.label).toBe("Board backlog")
    expect(groups[0]?.issueKeys).toEqual(state.issueKeysBySource.backlog)
    expect(backlogCreateSprintId(state)).toBeUndefined()
  })

  test("keeps Kanban board and backlog source membership isolated", () => {
    const state = loadDevWorkspaceState()
    const boardOnlyKey = state.issueKeysBySource.board?.[0]
    const backlogOnlyKey = state.issueKeysBySource.backlog?.[0]

    expect(boardOnlyKey).toBeTruthy()
    expect(backlogOnlyKey).toBeTruthy()
    expect(kanbanIssues(state).map((issue) => issue.key)).toContain(boardOnlyKey!)
    expect(kanbanIssues(state).map((issue) => issue.key)).not.toContain(backlogOnlyKey!)
    expect(groupBacklogIssues(state, "sprint")[0]?.issueKeys).toContain(backlogOnlyKey!)
    expect(groupBacklogIssues(state, "sprint")[0]?.issueKeys).not.toContain(boardOnlyKey!)
  })

  test("keeps Scrum planning groups, empty groups, and focused create context", () => {
    const state = loadDevWorkspaceState()
    state.board = { ...state.board, type: "scrum" }
    state.selectedBacklogGroupId = "sprint-25"

    const groups = groupBacklogIssues(state, "sprint")

    expect(groups.map((group) => group.label)).toEqual([
      "Active · Sprint 24 · 07/27-08/07",
      "Future · Sprint 25 · 08/10-08/21",
      "Future · Sprint 26",
      "Backlog",
    ])
    expect(groups.find((group) => group.id === "sprint-26")?.issueKeys).toEqual([])
    expect(backlogCreateSprintId(state)).toBe("sprint-25")
    state.selectedBacklogGroupId = "backlog"
    expect(backlogCreateSprintId(state)).toBeUndefined()
  })

  test("formats complete and partial Scrum sprint dates without inventing missing dates", () => {
    expect(sprintDateRange("2026-07-27T00:00:00.000Z", "2026-08-07T00:00:00.000Z")).toBe(" · 07/27-08/07")
    expect(sprintDateRange("2026-07-27", undefined)).toBe(" · starts 07/27")
    expect(sprintDateRange(undefined, "2026-08-07")).toBe(" · ends 08/07")
    expect(sprintDateRange(undefined, undefined)).toBe("")
  })

  test("distinguishes Jira-empty and filtered-empty surfaces", () => {
    const state = loadDevWorkspaceState()
    expect(emptyLoadedIssuesText(state, "board issues")).toBe("No board issues are loaded from Jira.")
    state.activeQuickFilters = ["blocked"]
    expect(emptyLoadedIssuesText(state, "board issues")).toBe("No loaded board issues match the active filters.")
  })

  test("does not treat a future sprint as an active sprint", () => {
    const state = loadDevWorkspaceState()
    state.activeSprintId = ""
    state.sprints = state.sprints.filter((sprint) => sprint.state === "future")
    expect(activeSprint(state)).toBeUndefined()
    expect(activeSprintIssues(state)).toEqual([])
  })
})
