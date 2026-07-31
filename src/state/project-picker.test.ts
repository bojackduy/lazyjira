import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { filteredProjectPickerBoards, filteredProjectPickerProjects, filteredProjectPickerWorkspaces, normalizedProjectQuery, projectPageCacheKey, projectPageStatus } from "./project-picker"

describe("project picker filtering", () => {
  test("filters local workspaces by project and board", () => {
    const state = loadDevWorkspaceState()
    state.recentWorkspaces = [
      { id: "PROJ:10", projectKey: "PROJ", projectName: "Product Platform", boardId: "10", boardName: "Platform Kanban", boardType: "kanban" },
      { id: "MOB:20", projectKey: "MOB", projectName: "Mobile Apps", boardId: "20", boardName: "Release Scrum", boardType: "scrum" },
    ]

    state.projectPicker.searchQuery = "mobile scrum"

    expect(filteredProjectPickerWorkspaces(state).map((workspace) => workspace.id)).toEqual(["MOB:20"])
  })

  test("uses only the server-returned project page", () => {
    const state = loadDevWorkspaceState()
    state.projectPicker.remoteProjectPage = { items: [
      { id: "dev-proj", key: "PROJ", name: "Product Platform" },
      { id: "dev-mob", key: "MOB", name: "Mobile Apps" },
      { id: "dev-ops", key: "OPS", name: "Internal Operations" },
    ], startAt: 0, maxResults: 50, total: 3, isLast: true }

    state.projectPicker.searchQuery = "mob"
    expect(filteredProjectPickerProjects(state).map((project) => project.key)).toEqual(["PROJ", "MOB", "OPS"])
  })

  test("normalizes cache keys and reports large-organization page status", () => {
    const state = loadDevWorkspaceState()
    state.projectPicker.remoteProjectPage = { items: Array.from({ length: 50 }, (_, index) => ({ id: String(index), key: `P${index}`, name: `Project ${index}` })), startAt: 50, maxResults: 50, total: 1919, isLast: false }

    expect(normalizedProjectQuery("  Health   CARE ")).toBe("health care")
    expect(projectPageCacheKey(" Health   CARE ", 50)).toBe(projectPageCacheKey("health care", 50))
    expect(projectPageStatus(state)).toBe("51-100 of 1919 · page 2/39")

    state.projectPicker.remoteProjectPage = { items: [], startAt: 0, maxResults: 50, total: 0, isLast: true }
    expect(projectPageStatus(state)).toBe("0-0 of 0 · page 0/0")
  })

  test("filters boards by name, type, and id", () => {
    const state = loadDevWorkspaceState()
    state.projectPicker.selectedProject = { id: "dev-proj", key: "PROJ", name: "Product Platform" }
    state.projectPicker.remoteBoardsByProject.PROJ = [
      { id: "10", name: "Platform Kanban", type: "kanban" },
      { id: "20", name: "Release Scrum", type: "scrum" },
    ]

    state.projectPicker.searchQuery = "scrum"
    expect(filteredProjectPickerBoards(state).map((board) => board.id)).toEqual(["20"])

    state.projectPicker.searchQuery = "platform 10"
    expect(filteredProjectPickerBoards(state).map((board) => board.id)).toEqual(["10"])
  })
})
