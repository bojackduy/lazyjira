import { describe, expect, test } from "bun:test"
import type { AppState, IssueSummary, StatusDefinition } from "./app-state"
import { boardIssueKeyAtLocation, nextKanbanHorizontalLocation, selectedBoardLocation } from "./board-navigation"
import { loadDemoWorkspace } from "./demo"

const statuses: StatusDefinition[] = [
  { id: "col-1", name: "Column 1", category: "todo", color: "#64748B" },
  { id: "col-2", name: "Column 2", category: "in-progress", color: "#38BDF8" },
  { id: "col-3", name: "Column 3", category: "done", color: "#22C55E" },
]

describe("board navigation", () => {
  test("moves horizontally through sparse Kanban cells in visual order", () => {
    const state = sparseKanbanState()

    expect(nextKanbanIssue(state, "A", 1)).toBe("B")
    expect(nextKanbanIssue(state, "B", 1)).toBe("C")
    expect(nextKanbanIssue(state, "C", 1)).toBe("D")
    expect(nextKanbanIssue(state, "D", 1)).toBeUndefined()
  })

  test("moves horizontally backward through sparse Kanban cells", () => {
    const state = sparseKanbanState()

    expect(nextKanbanIssue(state, "D", -1)).toBe("C")
    expect(nextKanbanIssue(state, "C", -1)).toBe("B")
    expect(nextKanbanIssue(state, "B", -1)).toBe("A")
    expect(nextKanbanIssue(state, "A", -1)).toBeUndefined()
  })
})

function nextKanbanIssue(state: AppState, issueKey: string, delta: 1 | -1) {
  const location = selectedBoardLocation(state, "kanban", issueKey)
  if (!location) return
  const next = nextKanbanHorizontalLocation(state, location, delta)
  return next ? boardIssueKeyAtLocation(state, "kanban", next) : undefined
}

function sparseKanbanState(): AppState {
  const issues = [
    issue("A", "col-1", "Group 1"),
    issue("B", "col-2", "Group 2"),
    issue("C", "col-3", "Group 2"),
    issue("D", "col-1", "Group 3"),
  ]
  return {
    ...loadDemoWorkspace(),
    statuses,
    issues: Object.fromEntries(issues.map((candidate) => [candidate.key, candidate])),
    kanbanGroupBy: "feature",
    activeQuickFilters: [],
    selectedIssueKey: "A",
  }
}

function issue(key: string, statusId: string, feature: string): IssueSummary {
  return {
    key,
    title: key,
    type: "Task",
    priority: "Medium",
    statusId,
    assignee: "Duy",
    reporter: "Duy",
    feature,
    labels: [],
    components: [],
    blocked: false,
    staleDays: 0,
    description: "",
    comments: [],
    links: [],
  }
}
