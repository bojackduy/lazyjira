import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { activeSprint, activeSprintIssues, backlogCreateSprintId, boardStatusWindowSize, emptyLoadedIssuesText, groupBacklogIssues, highestLevelIssueType, highestLoadedAncestor, issueTypeColorByIdentity, issueTypeName, kanbanIssues, matchesQuickFilters, parentIssueColor, resolvedBacklogSelection, sprintDateRange, topLevelLoadedAncestor, visibleStatusesForBoard } from "./selectors"
import { issueTypeColors } from "./metadata-colors"

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

  test("projects staged rank changes into the visible Backlog order", () => {
    const state = loadDevWorkspaceState()
    state.board = { ...state.board, type: "scrum" }
    const before = groupBacklogIssues(state, "sprint").find((group) => group.id === state.activeSprintId)!.issueKeys
    const issueKey = before[0]!
    const targetIssueKey = before[1]!
    state.rankDrafts[issueKey] = { issueKey, targetIssueKey, position: "after" }

    const after = groupBacklogIssues(state, "sprint").find((group) => group.id === state.activeSprintId)!.issueKeys

    expect(after.slice(0, 2)).toEqual([targetIssueKey, issueKey])
    expect(before.slice(0, 2)).toEqual([issueKey, targetIssueKey])
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

  test("matches Assignee: me by Jira account ID before display name", () => {
    const state = loadDevWorkspaceState()
    const issue = { ...state.issues[state.selectedIssueKey]!, assignee: "Renamed User", assigneeAccountId: "account-me" }
    state.currentUser = "Old Display Name"
    state.currentUserAccountId = "account-me"
    state.activeQuickFilters = ["mine"]

    expect(matchesQuickFilters(state, issue)).toBe(true)
    expect(matchesQuickFilters(state, { ...issue, assigneeAccountId: "someone-else" })).toBe(false)
  })

  test("uses normalized Jira type names when create metadata is unavailable", () => {
    const state = loadDevWorkspaceState()
    const issue = { ...state.issues[state.selectedIssueKey]!, type: "10009", typeName: "Story" }
    state.issueTypes = []

    expect(issueTypeName(state, issue)).toBe("Story")
    expect(issueTypeColorByIdentity(state, "10000", "Feature")).toBe(issueTypeColors.feature)
    state.issues["HPCE-1296"] = { ...issue, key: "HPCE-1296", type: "Feature", issueColor: "#36B37E" }
    expect(parentIssueColor(state, { key: "HPCE-1296", type: "Feature" })).toBe("#36B37E")
    expect(parentIssueColor(state, { key: "HPCE-1488", type: "Feature" })).toBe(issueTypeColors.feature)
  })

  test("resolves canonical Jira type IDs through issue type metadata", () => {
    const state = loadDevWorkspaceState()
    const issue = { ...state.issues[state.selectedIssueKey]!, type: "10009", typeName: undefined }
    state.issueTypes = [{ id: "10009", name: "Story", color: "#3B82F6" }]

    expect(issueTypeName(state, issue)).toBe("Story")
  })

  test("resolves the highest loaded ancestor and highest configured create level", () => {
    const state = loadDevWorkspaceState()
    state.issues.ROOT = { ...state.issues[state.selectedIssueKey]!, key: "ROOT", title: "Top initiative", type: "Initiative", parentKey: undefined }
    state.issues.PARENT = { ...state.issues[state.selectedIssueKey]!, key: "PARENT", title: "Middle epic", type: "Epic", parentKey: "ROOT" }
    const issue = { ...state.issues[state.selectedIssueKey]!, parentKey: "PARENT", parent: { key: "PARENT", title: "Middle epic", type: "Epic" } }

    expect(highestLoadedAncestor(state, issue)?.title).toBe("Top initiative")
    expect(topLevelLoadedAncestor(state, issue)?.title).toBe("Top initiative")
    expect(highestLevelIssueType(state)?.name).toBe("Initiative")

    state.issues.PARENT = { ...state.issues.PARENT!, type: "Story", parentKey: undefined }
    expect(topLevelLoadedAncestor(state, issue)).toBeUndefined()

    state.issueTypes = []
    state.issues.PARENT = { ...state.issues.PARENT!, typeHierarchyLevel: 1 }
    expect(topLevelLoadedAncestor(state, issue)?.title).toBe("Middle epic")
    state.issues.PARENT = { ...state.issues.PARENT!, typeHierarchyLevel: 0 }
    expect(topLevelLoadedAncestor(state, issue)).toBeUndefined()
    delete state.issues.PARENT
    expect(topLevelLoadedAncestor(state, { ...issue, parent: { ...issue.parent!, typeHierarchyLevel: 1 } })?.title).toBe("Middle epic")
  })

  test("repairs Backlog focus after another route leaves an empty group selected", () => {
    const groups = [
      { id: "future", label: "Future", issueKeys: [] },
      { id: "active", label: "Active", issueKeys: ["PROJ-1", "PROJ-2"] },
      { id: "backlog", label: "Backlog", issueKeys: ["PROJ-3"] },
    ]

    expect(resolvedBacklogSelection(groups, "future", "LIST-ONLY")).toEqual({ groupId: "active", issueKey: "PROJ-1" })
    expect(resolvedBacklogSelection(groups, "future", "PROJ-3")).toEqual({ groupId: "backlog", issueKey: "PROJ-3" })
  })
})
