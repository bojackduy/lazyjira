import { describe, expect, test } from "bun:test"
import { loadDemoWorkspace } from "./demo"
import { boardStatusWindowSize, visibleStatusesForBoard } from "./selectors"

describe("board selectors", () => {
  test("shows all statuses when the board is wide enough", () => {
    const state = loadDemoWorkspace()

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
    const state = loadDemoWorkspace()
    const windowSize = boardStatusWindowSize(130, state.statuses.length)

    expect(windowSize).toBeGreaterThan(0)
    expect(windowSize).toBeLessThan(state.statuses.length)
  })
})
