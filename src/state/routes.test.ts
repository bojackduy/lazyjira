import { describe, expect, test } from "bun:test"
import { appRoutes, isAppRoute, routeLabel, sidebarRoutes } from "./routes"

describe("routes", () => {
  test("defines the foundation routes", () => {
    expect(appRoutes.map((route) => route.id)).toEqual([
      "workspace",
      "active-sprint",
      "backlog",
      "kanban",
      "issue-detail",
    ])
  })

  test("keeps issue detail out of primary sidebar routes", () => {
    expect(sidebarRoutes.map((route) => route.id)).toEqual(["workspace", "active-sprint", "backlog", "kanban"])
  })

  test("guards route ids", () => {
    expect(isAppRoute("backlog")).toBe(true)
    expect(isAppRoute("settings")).toBe(false)
  })

  test("returns user-facing labels", () => {
    expect(routeLabel("active-sprint")).toBe("Active Sprint")
  })
})
