import { describe, expect, test } from "bun:test"
import {
  appRoutes,
  boardCapabilities,
  isAppRoute,
  normalizePersistedRoute,
  routeLabel,
  sidebarEntryCount,
  sidebarQuickFilterIndex,
  sidebarRoutesForBoard,
} from "./routes"

describe("routes", () => {
  test("defines scoped global, project, settings, and internal routes", () => {
    expect(appRoutes.map((route) => [route.id, route.scope])).toEqual([
      ["workspace", "global"],
      ["timeline", "project"],
      ["backlog", "project"],
      ["list", "project"],
      ["board", "project"],
      ["config", "settings"],
      ["issue-detail", "internal"],
    ])
  })

  test("uses Jira project order and Scrum board labeling", () => {
    expect(sidebarRoutesForBoard("scrum").map((route) => [route.id, route.shortLabel])).toEqual([
      ["workspace", "Workspace"],
      ["timeline", "Timeline"],
      ["backlog", "Backlog"],
      ["list", "List"],
      ["board", "Active sprints"],
    ])
    expect(boardCapabilities("scrum")).toMatchObject({ supportsSprints: true, supportsSprintBacklog: true })
  })

  test("uses Board for Kanban without exposing config as a primary destination", () => {
    expect(sidebarRoutesForBoard("kanban").map((route) => [route.id, route.shortLabel])).toEqual([
      ["workspace", "Workspace"],
      ["timeline", "Timeline"],
      ["backlog", "Backlog"],
      ["list", "List"],
      ["board", "Board"],
    ])
    expect(boardCapabilities("kanban")).toMatchObject({ supportsSprints: false, supportsSprintBacklog: false })
  })

  test("normalizes persisted legacy board routes", () => {
    expect(normalizePersistedRoute("active-sprint")).toBe("board")
    expect(normalizePersistedRoute("kanban")).toBe("board")
    expect(normalizePersistedRoute("backlog")).toBe("backlog")
    expect(normalizePersistedRoute("issue-detail")).toBe("board")
  })

  test("indexes quick filters after all primary destinations", () => {
    expect(sidebarQuickFilterIndex("scrum", 0)).toBe(5)
    expect(sidebarQuickFilterIndex("kanban", 3)).toBe(8)
    expect(sidebarEntryCount("kanban", 4)).toBe(9)
  })

  test("guards route ids and resolves board-aware labels", () => {
    expect(isAppRoute("board")).toBe(true)
    expect(isAppRoute("active-sprint")).toBe(false)
    expect(routeLabel("board", "scrum")).toBe("Active sprints")
    expect(routeLabel("board", "kanban")).toBe("Board")
  })
})
