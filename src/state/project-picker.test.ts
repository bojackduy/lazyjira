import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { filteredProjectPickerBoards, filteredProjectPickerProjects } from "./project-picker"

describe("project picker filtering", () => {
  test("filters projects by key and name", () => {
    const state = loadDevWorkspaceState()
    state.projectPicker.projects = [
      { id: "dev-proj", key: "PROJ", name: "Product Platform" },
      { id: "dev-mob", key: "MOB", name: "Mobile Apps" },
      { id: "dev-ops", key: "OPS", name: "Internal Operations" },
    ]

    state.projectPicker.searchQuery = "mob"
    expect(filteredProjectPickerProjects(state).map((project) => project.key)).toEqual(["MOB"])

    state.projectPicker.searchQuery = "internal ops"
    expect(filteredProjectPickerProjects(state).map((project) => project.key)).toEqual(["OPS"])
  })

  test("filters boards by name, type, and id", () => {
    const state = loadDevWorkspaceState()
    state.projectPicker.boards = [
      { id: "10", name: "Platform Kanban", type: "kanban" },
      { id: "20", name: "Release Scrum", type: "scrum" },
    ]

    state.projectPicker.searchQuery = "scrum"
    expect(filteredProjectPickerBoards(state).map((board) => board.id)).toEqual(["20"])

    state.projectPicker.searchQuery = "platform 10"
    expect(filteredProjectPickerBoards(state).map((board) => board.id)).toEqual(["10"])
  })
})
